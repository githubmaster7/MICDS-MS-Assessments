import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, type TxClient } from '@/lib/db'
import { sendRejectionEmail } from '@/lib/email'
import { auditApproval } from '@/lib/audit'
import { Role, AccountStatus } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey, adminApprovalLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

const RejectSchema = z.object({
  reason: z.string().max(500).optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const rl = await checkRateLimit(adminApprovalLimiter, userRateLimitKey(session.user.id))
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.msBeforeNext / 1000)) } },
    )
  }

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const parsed = RejectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input.' }, { status: 400 })
  }

  const { reason } = parsed.data

  const signupRequest = await db.signupRequest.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, status: true } },
    },
  })

  if (!signupRequest) {
    return NextResponse.json({ error: 'Signup request not found.' }, { status: 404 })
  }

  if (signupRequest.status !== AccountStatus.PENDING_ADMIN_APPROVAL) {
    return NextResponse.json(
      { error: 'This request has already been reviewed.' },
      { status: 409 },
    )
  }

  const ip = ipRateLimitKey(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  await db.$transaction(async (tx: TxClient) => {
    await tx.user.update({
      where: { id: signupRequest.userId },
      data: { status: AccountStatus.REJECTED },
    })

    await tx.signupRequest.update({
      where: { id },
      data: {
        status: AccountStatus.REJECTED,
        adminNote: reason ?? null,
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
      },
    })
  })

  await auditApproval({
    actorId: session.user.id,
    actorRole: session.user.role,
    targetUserId: signupRequest.userId,
    targetEmail: signupRequest.user.email,
    approved: false,
    reason,
    ipAddress: ip,
    userAgent,
  })

  try {
    await sendRejectionEmail(signupRequest.user.email, reason)
  } catch (err) {
    console.error('[reject] Failed to send rejection email:', err)
  }

  return NextResponse.json({ message: 'Signup request rejected.' })
}
