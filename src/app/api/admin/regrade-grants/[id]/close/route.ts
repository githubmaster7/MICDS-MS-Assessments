import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditRegradeGrant } from '@/lib/audit'
import { Role } from '@prisma/client'
import { ipRateLimitKey, rotationLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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

  const { id } = await params

  const grant = await db.classRegradeGrant.findUnique({
    where: { id },
    select: { id: true, historicalClassInstanceId: true, closedAt: true },
  })
  if (!grant) return NextResponse.json({ error: 'Regrade grant not found.' }, { status: 404 })
  if (grant.closedAt) return NextResponse.json({ error: 'This grant is already closed.' }, { status: 409 })

  const ip = ipRateLimitKey(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  await db.classRegradeGrant.update({
    where: { id },
    data: { closedAt: new Date(), closedBy: session.user.id },
  })

  await auditRegradeGrant({
    actorId: session.user.id,
    actorRole: session.user.role,
    grantId: grant.id,
    historicalClassInstanceId: grant.historicalClassInstanceId,
    action: 'CLOSED',
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({ message: 'Regrade grant closed.' })
}
