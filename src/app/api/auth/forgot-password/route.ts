import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { db } from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/email'
import { signupLimiter, checkRateLimit, ipRateLimitKey } from '@/lib/rate-limit'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { ALLOWED_EMAIL_DOMAIN } from '@/lib/constants'
import { AccountStatus } from '@prisma/client'

const ForgotPasswordSchema = z.object({
  email: z
    .string()
    .email()
    .transform((v) => v.toLowerCase().trim()),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = ipRateLimitKey(req)
  const rl = await checkRateLimit(signupLimiter, ip)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.msBeforeNext / 1000)) },
      },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = ForgotPasswordSchema.safeParse(body)
  if (!parsed.success) {
    // Always return generic message to prevent enumeration
    return NextResponse.json({
      message: 'If an account exists with that email, a reset link has been sent.',
    })
  }

  const { email } = parsed.data

  const domain = email.split('@')[1]
  if (domain !== ALLOWED_EMAIL_DOMAIN) {
    return NextResponse.json({
      message: 'If an account exists with that email, a reset link has been sent.',
    })
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, status: true },
  })

  // Always respond the same way to prevent enumeration
  const GENERIC_RESPONSE = NextResponse.json({
    message: 'If an account exists with that email, a reset link has been sent.',
  })

  if (
    !user ||
    user.status === AccountStatus.DEACTIVATED ||
    user.status === AccountStatus.REJECTED
  ) {
    return GENERIC_RESPONSE
  }

  // Invalidate any existing unused tokens for this user
  await db.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  })

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await db.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  })

  try {
    await sendPasswordResetEmail(email, token)
  } catch (err) {
    console.error('[forgot-password] Failed to send reset email:', err)
  }

  await createAuditLog({
    actorId: user.id,
    action: AuditAction.USER_PASSWORD_RESET_REQUESTED,
    targetType: 'User',
    targetId: user.id,
    targetLabel: email,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return GENERIC_RESPONSE
}
