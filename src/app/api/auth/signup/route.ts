import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { db, type TxClient } from '@/lib/db'
import { sendVerificationEmail } from '@/lib/email'
import { signupLimiter, checkRateLimit, ipRateLimitKey } from '@/lib/rate-limit'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { ALLOWED_EMAIL_DOMAIN } from '@/lib/constants'
import { AccountStatus, Role } from '@prisma/client'

const SignupSchema = z
  .object({
    email: z
      .string()
      .email('Invalid email address.')
      .transform((v) => v.toLowerCase().trim()),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .max(128, 'Password is too long.'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requestedRole: z.enum(['TEACHER', 'STUDENT', 'PARENT'] as const, {
      errorMap: () => ({ message: 'Invalid role.' }),
    }),
    // Parent signups must name at least one child at signup time — the admin
    // reviews and confirms this list before it's turned into real
    // ParentStudentLink rows at approval.
    studentProfileIds: z.array(z.string().uuid()).max(10).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.requestedRole === 'PARENT' && (!data.studentProfileIds || data.studentProfileIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['studentProfileIds'],
        message: 'Select at least one child.',
      })
    }
  })

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Rate limit by IP
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

  const parsed = SignupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input.' },
      { status: 400 },
    )
  }

  const { email, password, requestedRole, studentProfileIds } = parsed.data

  // Server-side domain enforcement
  const domain = email.split('@')[1]
  if (domain !== ALLOWED_EMAIL_DOMAIN) {
    // Return generic message to avoid leaking domain policy details
    return NextResponse.json(
      { error: 'Registration is not available for this email address.' },
      { status: 400 },
    )
  }

  // A parent must name real, existing students — not arbitrary IDs.
  let verifiedStudentIds: string[] = []
  if (requestedRole === 'PARENT' && studentProfileIds && studentProfileIds.length > 0) {
    const matches = await db.studentProfile.findMany({
      where: { id: { in: studentProfileIds } },
      select: { id: true },
    })
    verifiedStudentIds = matches.map((m) => m.id)
    if (verifiedStudentIds.length !== studentProfileIds.length) {
      return NextResponse.json(
        { error: 'One or more selected students could not be found. Please search again.' },
        { status: 400 },
      )
    }
  }

  // Check for existing user — return generic message to prevent enumeration
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    // Respond with 200 to prevent email enumeration
    return NextResponse.json({
      message:
        'If this email is eligible for registration, you will receive a verification email shortly.',
    })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Create user + verification token + signup request in one transaction
  const verificationToken = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  let userId: string
  try {
    const result = await db.$transaction(async (tx: TxClient) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: requestedRole as Role,
          status: AccountStatus.PENDING_EMAIL_VERIFICATION,
        },
      })

      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          token: verificationToken,
          expiresAt,
        },
      })

      const signupRequest = await tx.signupRequest.create({
        data: {
          userId: user.id,
          requestedRole: requestedRole as Role,
          status: AccountStatus.PENDING_EMAIL_VERIFICATION,
        },
      })

      if (verifiedStudentIds.length > 0) {
        await tx.signupRequestStudentLink.createMany({
          data: verifiedStudentIds.map((studentProfileId) => ({
            signupRequestId: signupRequest.id,
            studentProfileId,
          })),
        })
      }

      return user
    })
    userId = result.id
  } catch {
    return NextResponse.json(
      { error: 'An error occurred during registration. Please try again.' },
      { status: 500 },
    )
  }

  // Send verification email (best-effort — do not fail the request if email fails)
  try {
    await sendVerificationEmail(email, verificationToken)
  } catch (err) {
    console.error('[signup] Failed to send verification email:', err)
  }

  await createAuditLog({
    actorId: userId,
    action: AuditAction.USER_REGISTERED,
    targetType: 'User',
    targetId: userId,
    targetLabel: email,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({
    message:
      'If this email is eligible for registration, you will receive a verification email shortly.',
  })
}
