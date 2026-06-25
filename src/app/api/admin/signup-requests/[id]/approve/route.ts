import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendApprovalEmail } from '@/lib/email'
import { auditApproval, createAuditLog, AuditAction } from '@/lib/audit'
import { Role, AccountStatus } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey } from '@/lib/rate-limit'

const ApproveSchema = z.object({
  role: z.enum(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] as const),
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

  const { role } = parsed.data

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

  void profileLinkData // Profile link info is available for extended use

  await db.$transaction(async (tx) => {
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
      },
    })
  })

  await auditApproval({
    actorId: session.user.id,
    actorRole: session.user.role,
    targetUserId: signupRequest.userId,
    targetEmail: userEmail,
    approved: true,
    ipAddress: ip,
    userAgent,
  })

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.SIGNUP_REQUEST_APPROVED,
    targetType: 'SignupRequest',
    targetId: id,
    targetLabel: userEmail,
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
