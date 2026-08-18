import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey } from '@/lib/rate-limit'

const ToggleActiveSchema = z.object({
  isActive: z.boolean(),
})

const ReassignSchema = z.object({
  teacherProfileId: z.string().uuid().optional(),
  activityTemplateId: z.string().uuid().optional(),
  resolveConflictWithAssignmentId: z.string().uuid().optional(),
}).refine((d) => d.teacherProfileId !== undefined || d.activityTemplateId !== undefined, {
  message: 'At least one of teacherProfileId or activityTemplateId must be provided.',
})

interface RouteParams {
  params: Promise<{ id: string }>
}

const IdSchema = z.string().uuid()

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { id } = await params

  if (!IdSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  // Two distinct shapes hit this route: a plain isActive toggle (Remove /
  // Restore), and a reassign (change teacher and/or class).
  if (body !== null && typeof body === 'object' && 'isActive' in body) {
    return handleToggleActive(req, id, session, body)
  }
  return handleReassign(req, id, session, body)
}

async function handleToggleActive(
  req: NextRequest,
  id: string,
  session: { user: { id: string; role: Role } },
  body: unknown,
): Promise<NextResponse> {
  const parsed = ToggleActiveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const existing = await db.teacherClassAssignment.findUnique({
    where: { id },
    select: {
      id: true,
      isActive: true,
      teacherProfile: { select: { firstName: true, lastName: true } },
      activityTemplate: { select: { name: true } },
      _count: { select: { carouselPositions: true } },
    },
  })
  if (!existing) return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 })

  if (parsed.data.isActive === false && existing._count.carouselPositions > 0) {
    return NextResponse.json(
      {
        error:
          'This class is used in an active carousel plan. Remove it from the carousel positions first.',
      },
      { status: 409 },
    )
  }

  const ip = ipRateLimitKey(req)

  const updated = await db.teacherClassAssignment.update({
    where: { id },
    data: { isActive: parsed.data.isActive },
  })

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.TEACHER_CLASS_ASSIGNMENT_UPDATED,
    targetType: 'TeacherClassAssignment',
    targetId: id,
    targetLabel: `${existing.teacherProfile.firstName} ${existing.teacherProfile.lastName} · ${existing.activityTemplate.name}`,
    beforeValue: { isActive: existing.isActive },
    afterValue: { isActive: parsed.data.isActive },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: updated })
}

async function handleReassign(
  req: NextRequest,
  id: string,
  session: { user: { id: string; role: Role } },
  body: unknown,
): Promise<NextResponse> {
  const parsed = ReassignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }
  const { teacherProfileId, activityTemplateId, resolveConflictWithAssignmentId } = parsed.data

  const existing = await db.teacherClassAssignment.findUnique({
    where: { id },
    select: {
      id: true,
      schoolYearId: true,
      teacherProfileId: true,
      activityTemplateId: true,
      teacherProfile: { select: { firstName: true, lastName: true } },
      activityTemplate: { select: { name: true } },
    },
  })
  if (!existing) return NextResponse.json({ error: 'Assignment not found.' }, { status: 404 })

  const newTeacherId = teacherProfileId ?? existing.teacherProfileId
  const newActivityId = activityTemplateId ?? existing.activityTemplateId

  if (newTeacherId === existing.teacherProfileId && newActivityId === existing.activityTemplateId) {
    return NextResponse.json({ data: existing })
  }

  const [newTeacher, newActivity] = await Promise.all([
    db.teacherProfile.findUnique({ where: { id: newTeacherId }, select: { id: true, firstName: true, lastName: true } }),
    db.activityTemplate.findUnique({ where: { id: newActivityId }, select: { id: true, name: true } }),
  ])
  if (!newTeacher) return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 })
  if (!newActivity) return NextResponse.json({ error: 'Class not found.' }, { status: 404 })

  // Exact (teacher, activity, year) collision — the target row already
  // exists verbatim. Auto-merging two assignments for the same teacher is
  // rare enough to just block rather than silently combine.
  const exactCollision = await db.teacherClassAssignment.findFirst({
    where: {
      teacherProfileId: newTeacherId,
      activityTemplateId: newActivityId,
      schoolYearId: existing.schoolYearId,
      NOT: { id },
    },
    select: { id: true },
  })
  if (exactCollision) {
    return NextResponse.json(
      { error: `${newTeacher.firstName} ${newTeacher.lastName} is already assigned to ${newActivity.name}.` },
      { status: 409 },
    )
  }

  const ip = ipRateLimitKey(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  // The class itself is changing — check whether some other teacher already
  // teaches the target class. If so, offer a swap instead of creating a
  // second position for the same activity.
  if (newActivityId !== existing.activityTemplateId) {
    const duplicate = await db.teacherClassAssignment.findFirst({
      where: { activityTemplateId: newActivityId, schoolYearId: existing.schoolYearId, NOT: { id } },
      select: {
        id: true,
        teacherProfileId: true,
        teacherProfile: { select: { firstName: true, lastName: true } },
      },
    })

    if (duplicate && resolveConflictWithAssignmentId !== duplicate.id) {
      return NextResponse.json(
        {
          conflict: {
            assignmentId: duplicate.id,
            teacherName: `${duplicate.teacherProfile.firstName} ${duplicate.teacherProfile.lastName}`,
            activityName: newActivity.name,
            yourActivityName: existing.activityTemplate.name,
          },
        },
        { status: 409 },
      )
    }

    if (duplicate) {
      // Confirmed swap: this assignment takes the target activity, the
      // other one takes back whatever this assignment used to teach.
      const swapCollision = await db.teacherClassAssignment.findFirst({
        where: {
          teacherProfileId: duplicate.teacherProfileId,
          activityTemplateId: existing.activityTemplateId,
          schoolYearId: existing.schoolYearId,
          NOT: { id: duplicate.id },
        },
        select: { id: true },
      })
      if (swapCollision) {
        return NextResponse.json(
          { error: `${duplicate.teacherProfile.firstName} ${duplicate.teacherProfile.lastName} is already assigned to ${existing.activityTemplate.name} — can't swap.` },
          { status: 409 },
        )
      }

      const [updatedThis, updatedOther] = await db.$transaction([
        db.teacherClassAssignment.update({
          where: { id },
          data: { teacherProfileId: newTeacherId, activityTemplateId: newActivityId },
        }),
        db.teacherClassAssignment.update({
          where: { id: duplicate.id },
          data: { activityTemplateId: existing.activityTemplateId },
        }),
      ])

      await createAuditLog({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: AuditAction.TEACHER_CLASS_ASSIGNMENT_UPDATED,
        targetType: 'TeacherClassAssignment',
        targetId: id,
        targetLabel: `${newTeacher.firstName} ${newTeacher.lastName} · ${newActivity.name}`,
        beforeValue: { teacherProfileId: existing.teacherProfileId, activityTemplateId: existing.activityTemplateId },
        afterValue: { teacherProfileId: newTeacherId, activityTemplateId: newActivityId, swappedWith: duplicate.id },
        ipAddress: ip,
        userAgent,
      })
      await createAuditLog({
        actorId: session.user.id,
        actorRole: session.user.role,
        action: AuditAction.TEACHER_CLASS_ASSIGNMENT_UPDATED,
        targetType: 'TeacherClassAssignment',
        targetId: duplicate.id,
        targetLabel: `${duplicate.teacherProfile.firstName} ${duplicate.teacherProfile.lastName} · ${existing.activityTemplate.name}`,
        beforeValue: { activityTemplateId: newActivityId },
        afterValue: { activityTemplateId: existing.activityTemplateId, swappedWith: id },
        ipAddress: ip,
        userAgent,
      })

      return NextResponse.json({ data: { swapped: true, thisAssignment: updatedThis, otherAssignment: updatedOther } })
    }
  }

  // No conflict — plain in-place update. The carousel position (if any)
  // keeps pointing at this same row and its rotation order, so nothing
  // about scheduling changes; only the teacher and/or activity it refers to.
  const updated = await db.teacherClassAssignment.update({
    where: { id },
    data: { teacherProfileId: newTeacherId, activityTemplateId: newActivityId },
  })

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.TEACHER_CLASS_ASSIGNMENT_UPDATED,
    targetType: 'TeacherClassAssignment',
    targetId: id,
    targetLabel: `${newTeacher.firstName} ${newTeacher.lastName} · ${newActivity.name}`,
    beforeValue: { teacherProfileId: existing.teacherProfileId, activityTemplateId: existing.activityTemplateId },
    afterValue: { teacherProfileId: newTeacherId, activityTemplateId: newActivityId },
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({ data: updated })
}
