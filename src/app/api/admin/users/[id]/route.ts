import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { Role, AccountStatus } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey } from '@/lib/rate-limit'

const UpdateUserSchema = z.object({
  role: z.enum(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] as const).optional(),
  status: z
    .enum(['ACTIVE', 'DEACTIVATED', 'PENDING_ADMIN_APPROVAL', 'PENDING_EMAIL_VERIFICATION', 'REJECTED'] as const)
    .optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

async function requireAdmin(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  if (session.user.role !== Role.ADMIN) return null
  return session
}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await requireAdmin(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { id } = await params

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
      studentProfile: {
        select: { id: true, firstName: true, lastName: true, gradeLevel: true, gender: true, studentId: true },
      },
      teacherProfile: {
        select: { id: true, firstName: true, lastName: true, employeeId: true },
      },
      parentProfile: {
        select: { id: true, firstName: true, lastName: true },
      },
      signupRequest: {
        select: { id: true, requestedRole: true, status: true, adminNote: true, createdAt: true },
      },
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  return NextResponse.json({ data: user })
}

export async function PUT(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await requireAdmin(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = UpdateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input.' },
      { status: 400 },
    )
  }

  const updateData = parsed.data
  if (!updateData.role && !updateData.status) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
  }

  const existing = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true, status: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  // Prevent admin from deactivating themselves
  if (id === session.user.id && updateData.status === 'DEACTIVATED') {
    return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 })
  }

  const ip = ipRateLimitKey(req)

  const updated = await db.user.update({
    where: { id },
    data: {
      ...(updateData.role ? { role: updateData.role as Role } : {}),
      ...(updateData.status ? { status: updateData.status as AccountStatus } : {}),
    },
    select: { id: true, email: true, role: true, status: true, updatedAt: true },
  })

  const action =
    updateData.status === AccountStatus.DEACTIVATED
      ? AuditAction.USER_DEACTIVATED
      : updateData.status === AccountStatus.ACTIVE
        ? AuditAction.USER_REACTIVATED
        : AuditAction.SIGNUP_REQUEST_APPROVED

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action,
    targetType: 'User',
    targetId: id,
    targetLabel: updated.email,
    beforeValue: { role: existing.role, status: existing.status },
    afterValue: { role: updated.role, status: updated.status },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await requireAdmin(req)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { id } = await params

  if (id === session.user.id) {
    return NextResponse.json({ error: 'You cannot deactivate your own account.' }, { status: 400 })
  }

  const existing = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, status: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  if (existing.status === AccountStatus.DEACTIVATED) {
    return NextResponse.json({ error: 'User is already deactivated.' }, { status: 409 })
  }

  const ip = ipRateLimitKey(req)

  await db.user.update({
    where: { id },
    data: { status: AccountStatus.DEACTIVATED },
  })

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.USER_DEACTIVATED,
    targetType: 'User',
    targetId: id,
    targetLabel: existing.email,
    beforeValue: { status: existing.status },
    afterValue: { status: AccountStatus.DEACTIVATED },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ message: 'User deactivated.' })
}
