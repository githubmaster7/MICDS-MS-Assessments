import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ id: string }>
}

const AddMemberSchema = z.object({
  studentProfileId: z.string().uuid(),
})

const RemoveMemberSchema = z.object({
  studentProfileId: z.string().uuid(),
})

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { id } = await params

  const group = await db.studentGroup.findUnique({ where: { id }, select: { id: true } })
  if (!group) return NextResponse.json({ error: 'Student group not found.' }, { status: 404 })

  const activeOnly = req.nextUrl.searchParams.get('activeOnly') !== 'false'

  const memberships = await db.studentGroupMembership.findMany({
    where: {
      studentGroupId: id,
      ...(activeOnly ? { leftAt: null } : {}),
    },
    orderBy: { joinedAt: 'asc' },
    include: {
      studentProfile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          gradeLevel: true,
          gender: true,
          studentId: true,
        },
      },
    },
  })

  return NextResponse.json({ data: memberships })
}

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = AddMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { studentProfileId } = parsed.data

  const [group, studentProfile] = await Promise.all([
    db.studentGroup.findUnique({ where: { id }, select: { id: true, name: true, schoolYearId: true } }),
    db.studentProfile.findUnique({ where: { id: studentProfileId }, select: { id: true, firstName: true, lastName: true } }),
  ])

  if (!group) return NextResponse.json({ error: 'Student group not found.' }, { status: 404 })
  if (!studentProfile) return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 })

  // Check if already a member
  const existing = await db.studentGroupMembership.findUnique({
    where: { studentGroupId_studentProfileId: { studentGroupId: id, studentProfileId } },
    select: { id: true, leftAt: true },
  })

  const ip = ipRateLimitKey(req)

  if (existing) {
    if (existing.leftAt === null) {
      return NextResponse.json({ error: 'Student is already a member of this group.' }, { status: 409 })
    }
    // Rejoin — update leftAt to null
    const membership = await db.studentGroupMembership.update({
      where: { id: existing.id },
      data: { leftAt: null, joinedAt: new Date() },
    })

    await createAuditLog({
      actorId: session.user.id,
      actorRole: session.user.role,
      action: AuditAction.STUDENT_GROUP_MEMBERSHIP_ADDED,
      targetType: 'StudentGroupMembership',
      targetId: membership.id,
      targetLabel: `${studentProfile.firstName} ${studentProfile.lastName} → ${group.name}`,
      ipAddress: ip,
      userAgent: req.headers.get('user-agent') ?? undefined,
    })

    return NextResponse.json({ data: membership }, { status: 201 })
  }

  const membership = await db.studentGroupMembership.create({
    data: { studentGroupId: id, studentProfileId },
  })

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.STUDENT_GROUP_MEMBERSHIP_ADDED,
    targetType: 'StudentGroupMembership',
    targetId: membership.id,
    targetLabel: `${studentProfile.firstName} ${studentProfile.lastName} → ${group.name}`,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: membership }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = RemoveMemberSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { studentProfileId } = parsed.data

  const membership = await db.studentGroupMembership.findUnique({
    where: { studentGroupId_studentProfileId: { studentGroupId: id, studentProfileId } },
    select: { id: true, leftAt: true },
  })

  if (!membership || membership.leftAt !== null) {
    return NextResponse.json({ error: 'Student is not an active member of this group.' }, { status: 404 })
  }

  const ip = ipRateLimitKey(req)

  await db.studentGroupMembership.update({
    where: { id: membership.id },
    data: { leftAt: new Date() },
  })

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.STUDENT_GROUP_MEMBERSHIP_REMOVED,
    targetType: 'StudentGroupMembership',
    targetId: membership.id,
    targetLabel: `studentProfileId:${studentProfileId} from groupId:${id}`,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ message: 'Member removed.' })
}
