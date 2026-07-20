import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditRegradeGrant } from '@/lib/audit'
import { Role } from '@prisma/client'
import { ipRateLimitKey, rotationLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

/**
 * The "Lock All Groups" convenience action — the counterpart to
 * regrade-grants/bulk-all: closes every currently-open ClassRegradeGrant in
 * one action, immediately revoking whatever teacher-regrade/student-resubmit
 * access is currently open, across every group.
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

  const ip = ipRateLimitKey(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  const openGrants = await db.classRegradeGrant.findMany({
    where: { closedAt: null },
    select: { id: true, historicalClassInstanceId: true },
  })

  if (openGrants.length === 0) {
    return NextResponse.json({ data: { closedCount: 0, message: 'No open regrade grants to close.' } })
  }

  const now = new Date()
  await db.classRegradeGrant.updateMany({
    where: { id: { in: openGrants.map((g) => g.id) } },
    data: { closedAt: now, closedBy: session.user.id },
  })

  for (const grant of openGrants) {
    await auditRegradeGrant({
      actorId: session.user.id,
      actorRole: session.user.role,
      grantId: grant.id,
      historicalClassInstanceId: grant.historicalClassInstanceId,
      action: 'BULK_CLOSED',
      ipAddress: ip,
      userAgent,
    })
  }

  return NextResponse.json({
    data: {
      closedCount: openGrants.length,
      message: `${openGrants.length} regrade grant${openGrants.length !== 1 ? 's' : ''} closed.`,
    },
  })
}
