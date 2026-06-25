import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emailVerifyLimiter, checkRateLimit, ipRateLimitKey } from '@/lib/rate-limit'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { AccountStatus } from '@prisma/client'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = ipRateLimitKey(req)
  const rl = await checkRateLimit(emailVerifyLimiter, ip)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.msBeforeNext / 1000)) },
      },
    )
  }

  const token = req.nextUrl.searchParams.get('token')
  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid or missing token.' }, { status: 400 })
  }

  const record = await db.emailVerificationToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, status: true } } },
  })

  // Return identical errors for not-found vs expired to prevent enumeration
  if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'This verification link is invalid or has expired.' },
      { status: 400 },
    )
  }

  if (record.user.status !== AccountStatus.PENDING_EMAIL_VERIFICATION) {
    // Already verified — treat as success to handle duplicate clicks gracefully
    return NextResponse.json({ message: 'Email address already verified.' })
  }

  await db.$transaction(async (tx) => {
    await tx.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    })

    await tx.user.update({
      where: { id: record.userId },
      data: {
        status: AccountStatus.PENDING_ADMIN_APPROVAL,
        emailVerifiedAt: new Date(),
      },
    })

    // Advance the signup request status too
    await tx.signupRequest.updateMany({
      where: {
        userId: record.userId,
        status: AccountStatus.PENDING_EMAIL_VERIFICATION,
      },
      data: { status: AccountStatus.PENDING_ADMIN_APPROVAL },
    })
  })

  await createAuditLog({
    actorId: record.userId,
    action: AuditAction.USER_EMAIL_VERIFIED,
    targetType: 'User',
    targetId: record.userId,
    targetLabel: record.user.email,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({
    message: 'Email verified. Your account is pending administrator approval.',
  })
}
