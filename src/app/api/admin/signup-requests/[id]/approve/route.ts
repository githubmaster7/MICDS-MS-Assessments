import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, type TxClient } from '@/lib/db'
import { sendApprovalEmail } from '@/lib/email'
import { auditApproval } from '@/lib/audit'
import { Role, AccountStatus, GradeLevel, Gender, Prisma } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey, adminApprovalLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

const ApproveSchema = z
  .object({
    role: z.enum(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] as const),
    note: z.string().trim().max(2000).optional(),
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    gradeLevel: z.enum(['GRADE_6', 'GRADE_7', 'GRADE_8'] as const).optional(),
    gender: z.enum(['MALE', 'FEMALE'] as const).optional(),
    studentId: z.string().trim().min(1).max(50).optional(),
    employeeId: z.string().trim().min(1).max(50).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'ADMIN') return
    if (!data.firstName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['firstName'], message: 'First name is required.' })
    }
    if (!data.lastName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lastName'], message: 'Last name is required.' })
    }
    if (data.role === 'STUDENT') {
      if (!data.gradeLevel) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gradeLevel'], message: 'Grade level is required.' })
      }
      if (!data.gender) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['gender'], message: 'Gender is required.' })
      }
      if (!data.studentId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['studentId'], message: 'Student ID is required.' })
      }
    }
    if (data.role === 'TEACHER' && !data.employeeId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['employeeId'], message: 'Employee ID is required.' })
    }
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
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = ApproveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input.' },
      { status: 400 },
    )
  }

  const { role, note, firstName, lastName, gradeLevel, gender, studentId, employeeId } = parsed.data

  const signupRequest = await db.signupRequest.findUnique({
    where: { id },
    include: {
      user: {
        select: { id: true, email: true, status: true, role: true },
      },
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

  // Link to existing profile by email if one exists for the assigned role
  const userEmail = signupRequest.user.email
  let profileLinkData: Record<string, unknown> = {}

  if (role === Role.STUDENT) {
    const existingProfile = await db.studentProfile.findFirst({
      where: { user: { email: userEmail } },
      select: { id: true },
    })
    if (existingProfile) {
      profileLinkData = { studentProfileId: existingProfile.id }
    }
  } else if (role === Role.TEACHER) {
    const existingProfile = await db.teacherProfile.findFirst({
      where: { user: { email: userEmail } },
      select: { id: true },
    })
    if (existingProfile) {
      profileLinkData = { teacherProfileId: existingProfile.id }
    }
  } else if (role === Role.PARENT) {
    const existingProfile = await db.parentProfile.findFirst({
      where: { user: { email: userEmail } },
      select: { id: true },
    })
    if (existingProfile) {
      profileLinkData = { parentProfileId: existingProfile.id }
    }
  }

  try {
    await db.$transaction(async (tx: TxClient) => {
      await tx.user.update({
        where: { id: signupRequest.userId },
        data: { status: AccountStatus.ACTIVE, role: role as Role },
      })

      await tx.signupRequest.update({
        where: { id },
        data: {
          status: AccountStatus.ACTIVE,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          adminNote: note ?? undefined,
        },
      })

      // Create the role-specific profile if this user doesn't already have one
      // (e.g. pre-linked by email match above, from an earlier seed/import).
      if (role === Role.STUDENT && !profileLinkData.studentProfileId) {
        await tx.studentProfile.create({
          data: {
            userId: signupRequest.userId,
            firstName: firstName!,
            lastName: lastName!,
            gradeLevel: gradeLevel as GradeLevel,
            gender: gender as Gender,
            studentId: studentId!,
          },
        })
      } else if (role === Role.TEACHER && !profileLinkData.teacherProfileId) {
        await tx.teacherProfile.create({
          data: {
            userId: signupRequest.userId,
            firstName: firstName!,
            lastName: lastName!,
            employeeId: employeeId!,
          },
        })
      } else if (role === Role.PARENT && !profileLinkData.parentProfileId) {
        await tx.parentProfile.create({
          data: {
            userId: signupRequest.userId,
            firstName: firstName!,
            lastName: lastName!,
          },
        })
      }
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field'
      return NextResponse.json(
        { error: `That ${target} is already in use by another profile. Please use a different value.` },
        { status: 409 },
      )
    }
    throw err
  }

  await auditApproval({
    actorId: session.user.id,
    actorRole: session.user.role,
    targetUserId: signupRequest.userId,
    targetEmail: userEmail,
    approved: true,
    afterValue: { role, status: AccountStatus.ACTIVE },
    ipAddress: ip,
    userAgent,
  })

  try {
    await sendApprovalEmail(userEmail, role)
  } catch (err) {
    console.error('[approve] Failed to send approval email:', err)
  }

  return NextResponse.json({ message: 'Account approved successfully.' })
}
