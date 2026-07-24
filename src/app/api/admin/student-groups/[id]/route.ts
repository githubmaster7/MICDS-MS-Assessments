import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey } from '@/lib/rate-limit'

const UpdateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
})

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { id } = await params

  const group = await db.studentGroup.findUnique({
    where: { id },
    include: {
      schoolYear: { select: { id: true, name: true } },
      _count: { select: { memberships: true } },
      groupRotationAssignments: {
        orderBy: { rotationNumber: 'desc' },
        select: {
          id: true,
          rotationNumber: true,
          status: true,
          startDate: true,
          endDate: true,
          carouselPosition: {
            select: {
              positionOrder: true,
              teacherClassAssignment: {
                select: {
                  teacherProfile: { select: { firstName: true, lastName: true } },
                  activityTemplate: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!group) return NextResponse.json({ error: 'Student group not found.' }, { status: 404 })

  return NextResponse.json({ data: group })
}

export async function PUT(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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

  const parsed = UpdateGroupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const updateData = parsed.data
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 })
  }

  const existing = await db.studentGroup.findUnique({
    where: { id },
    select: { id: true, name: true, schoolYearId: true, isActive: true },
  })
  if (!existing) return NextResponse.json({ error: 'Student group not found.' }, { status: 404 })

  // Check for name collision if name is changing
  if (updateData.name && updateData.name !== existing.name) {
    const collision = await db.studentGroup.findUnique({
      where: { schoolYearId_name: { schoolYearId: existing.schoolYearId, name: updateData.name } },
      select: { id: true },
    })
    if (collision) {
      return NextResponse.json(
        { error: 'A group with this name already exists in this school year.' },
        { status: 409 },
      )
    }
  }

  const ip = ipRateLimitKey(req)

  const updated = await db.studentGroup.update({
    where: { id },
    data: updateData,
  })

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.STUDENT_GROUP_UPDATED,
    targetType: 'StudentGroup',
    targetId: id,
    targetLabel: updated.name,
    beforeValue: { name: existing.name, isActive: existing.isActive },
    afterValue: updateData,
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { id } = await params

  const existing = await db.studentGroup.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      isActive: true,
      _count: { select: { groupRotationAssignments: true, historicalClassInstances: true, memberships: true } },
    },
  })
  if (!existing) return NextResponse.json({ error: 'Student group not found.' }, { status: 404 })

  if (existing.isActive) {
    return NextResponse.json(
      { error: 'Remove this group first before permanently deleting it.' },
      { status: 409 },
    )
  }

  if (existing._count.groupRotationAssignments > 0 || existing._count.historicalClassInstances > 0) {
    return NextResponse.json(
      {
        error:
          'This group has rotation and grade history, so it can only be removed (archived), not permanently deleted.',
      },
      { status: 409 },
    )
  }

  const ip = ipRateLimitKey(req)

  await db.studentGroup.delete({ where: { id } })

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.STUDENT_GROUP_DELETED,
    targetType: 'StudentGroup',
    targetId: id,
    targetLabel: existing.name,
    beforeValue: { name: existing.name, memberships: existing._count.memberships },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: { id } })
}
