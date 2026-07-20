import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, type TxClient } from '@/lib/db'
import { auditRegradeGrant } from '@/lib/audit'
import { Role, RotationStatus } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey, rotationLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

const BulkGrantSchema = z.object({
  teacherRegradeEnabled: z.boolean(),
  reason: z.string().min(1, 'A reason is required to reopen a locked instance.').max(500),
})

/**
 * The "reopen everything" convenience action: for every active StudentGroup,
 * reopen its most-recently-locked class instance for its full current
 * roster. Groups with no locked history are skipped, not errored — mirrors
 * the { rotated, errors } response shape used by the carousel rotate route.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const rl = await checkRateLimit(rotationLimiter, userRateLimitKey(session.user.id))
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.msBeforeNext / 1000)) } },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = BulkGrantSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { teacherRegradeEnabled, reason } = parsed.data

  const ip = ipRateLimitKey(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  const groups = await db.studentGroup.findMany({ where: { isActive: true }, select: { id: true, name: true } })

  const opened: Array<{ studentGroupId: string; groupName: string; grantId: string; studentCount: number }> = []
  const skipped: Array<{ studentGroupId: string; groupName: string; reason: string }> = []

  for (const group of groups) {
    const mostRecentLocked = await db.historicalClassInstance.findFirst({
      where: { studentGroupId: group.id, status: RotationStatus.LOCKED },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })

    if (!mostRecentLocked) {
      skipped.push({ studentGroupId: group.id, groupName: group.name, reason: 'No locked class history for this group.' })
      continue
    }

    const currentMembers = await db.studentGroupMembership.findMany({
      where: { studentGroupId: group.id, leftAt: null },
      select: { studentProfileId: true },
    })

    if (!teacherRegradeEnabled && currentMembers.length === 0) {
      skipped.push({ studentGroupId: group.id, groupName: group.name, reason: 'No current students to reopen for.' })
      continue
    }

    const grant = await db.$transaction(async (tx: TxClient) => {
      const created = await tx.classRegradeGrant.create({
        data: {
          historicalClassInstanceId: mostRecentLocked.id,
          teacherRegradeEnabled,
          reason,
          openedBy: session.user.id,
        },
      })

      if (currentMembers.length > 0) {
        await tx.classRegradeGrantStudent.createMany({
          data: currentMembers.map((m) => ({ grantId: created.id, studentProfileId: m.studentProfileId })),
        })
      }

      return created
    })

    await auditRegradeGrant({
      actorId: session.user.id,
      actorRole: session.user.role,
      grantId: grant.id,
      historicalClassInstanceId: mostRecentLocked.id,
      action: 'BULK_OPENED',
      reason: `${group.name}: ${reason}`,
      teacherRegradeEnabled,
      studentCount: currentMembers.length,
      ipAddress: ip,
      userAgent,
    })

    opened.push({ studentGroupId: group.id, groupName: group.name, grantId: grant.id, studentCount: currentMembers.length })
  }

  return NextResponse.json({
    data: {
      opened,
      skipped,
      message: `${opened.length} group${opened.length !== 1 ? 's' : ''} reopened, ${skipped.length} skipped.`,
    },
  })
}
