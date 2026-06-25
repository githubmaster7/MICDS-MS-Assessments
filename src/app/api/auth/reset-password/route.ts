import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/lib/db'
import { emailVerifyLimiter, checkRateLimit, ipRateLimitKey } from '@/lib/rate-limit'
import { createAuditLog, AuditAction } from '@/lib/audit'

const ResetPasswordSchema = z.object({
  token: z.string().min(32, 'Invalid token.').max(128),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(128, 'Password is too long.'),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = ResetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input.' },
      { status: 400 },
    )
  }

  const { token, password } = parsed.data

  const record = await db.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true } } },
  })

  if (!record || record.usedAt !== null || record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: 'This reset link is invalid or has expired.' },
      { status: 400 },
    )
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await db.$transaction(async (tx) => {
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    })

    await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    })
  })

  await createAuditLog({
    actorId: record.userId,
    action: AuditAction.USER_PASSWORD_RESET,
    targetType: 'User',
    targetId: record.userId,
    targetLabel: record.user.email,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ message: 'Password reset successfully. You may now sign in.' })
}
