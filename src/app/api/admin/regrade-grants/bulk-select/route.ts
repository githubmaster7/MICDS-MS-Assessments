import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, type TxClient } from '@/lib/db'
import { auditRegradeGrant } from '@/lib/audit'
import { Role, RotationStatus } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey, rotationLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

const BulkSelectSchema = z.object({
  groupIds: z.array(z.string().uuid()).min(1, 'Select at least one group.'),
  teacherProfileIds: z.array(z.string().uuid()),
  studentProfileIds: z.array(z.string().uuid()),
  reason: z.string().min(1, 'A reason is required to reopen a locked instance.').max(500),
})

/**
 * The selective counterpart to bulk-all: Groups, Teachers, and Students are
 * chosen independently (checking a group never auto-selects its teacher or
 * students). For each selected group's most-recently-locked instance,
 * teacher regrade is granted only if that instance's teacher is among the
 * selected teachers, and student resubmit is granted only for the selected
 * students who are current members of that specific group.
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

  const parsed = BulkSelectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { groupIds, teacherProfileIds, studentProfileIds, reason } = parsed.data
  const teacherSet = new Set(teacherProfileIds)
  const studentSet = new Set(studentProfileIds)

  const groups = await db.studentGroup.findMany({ where: { id: { in: groupIds }, isActive: true }, select: { id: true, name: true } })
  if (groups.length !== groupIds.length) {
    return NextResponse.json({ error: 'One or more selected groups were not found or are no longer active.' }, { status: 404 })
  }

  const ip = ipRateLimitKey(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  const opened: Array<{ studentGroupId: string; groupName: string; grantId: string; teacherRegradeEnabled: boolean; studentCount: number }> = []
  const skipped: Array<{ studentGroupId: string; groupName: string; reason: string }> = []

  for (const group of groups) {
    const mostRecentLocked = await db.historicalClassInstance.findFirst({
      where: { studentGroupId: group.id, status: RotationStatus.LOCKED },
      orderBy: { createdAt: 'desc' },
      select: { id: true, teacherClassAssignment: { select: { teacherProfileId: true } } },
    })

    if (!mostRecentLocked) {
      skipped.push({ studentGroupId: group.id, groupName: group.name, reason: 'No locked class history for this group.' })
      continue
    }

    const teacherRegradeEnabled = teacherSet.has(mostRecentLocked.teacherClassAssignment.teacherProfileId)

    const currentMembers = await db.studentGroupMembership.findMany({
      where: { studentGroupId: group.id, leftAt: null, studentProfileId: { in: [...studentSet] } },
      select: { studentProfileId: true },
    })

    if (!teacherRegradeEnabled && currentMembers.length === 0) {
      skipped.push({ studentGroupId: group.id, groupName: group.name, reason: 'Neither this group\'s teacher nor any of its students were selected.' })
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

    opened.push({
      studentGroupId: group.id,
      groupName: group.name,
      grantId: grant.id,
      teacherRegradeEnabled,
      studentCount: currentMembers.length,
    })
  }

  return NextResponse.json({
    data: {
      opened,
      skipped,
      message: `${opened.length} group${opened.length !== 1 ? 's' : ''} reopened, ${skipped.length} skipped.`,
    },
  })
}
