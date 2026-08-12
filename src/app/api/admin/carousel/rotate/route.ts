import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, type TxClient } from '@/lib/db'
import { auditRotation, AuditAction } from '@/lib/audit'
import { rotationLimiter, checkRateLimit, ipRateLimitKey } from '@/lib/rate-limit'
import { Role, RotationStatus } from '@prisma/client'
import { z } from 'zod'
import { validateCarouselRotation, computeNextRotationAssignments } from '@/lib/carousel/engine'
import { createGradeSnapshot } from '@/lib/grading/snapshot'

const RotateSchema = z.object({
  planId: z.string().uuid(),
  studentGroupIds: z.array(z.string().uuid()).min(1, 'Select at least one group to rotate.'),
  confirm: z.boolean().default(false),
  override: z.boolean().default(false),
  notes: z.string().max(1000).optional(),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
})

interface GroupPreview {
  studentGroupId: string
  groupName: string
  currentActivity: string | null
  currentTeacher: string | null
  nextActivity: string | null
  nextTeacher: string | null
  earlyRotation: { currentEndDate: Date } | null
  error?: string
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const ip = ipRateLimitKey(req)
  const rl = await checkRateLimit(rotationLimiter, `user:${session.user.id}`)
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many rotation requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.msBeforeNext / 1000)) } },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = RotateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { planId, studentGroupIds, confirm, override, notes, startDate, endDate } = parsed.data

  const start = new Date(startDate)
  const end = new Date(endDate)
  if (end <= start) {
    return NextResponse.json({ error: 'endDate must be after startDate.' }, { status: 400 })
  }

  const plan = await db.carouselPlan.findUnique({ where: { id: planId } })
  if (!plan) return NextResponse.json({ error: 'Carousel plan not found.' }, { status: 404 })

  const groups = await db.studentGroup.findMany({ where: { id: { in: studentGroupIds }, isActive: true } })
  if (groups.length !== studentGroupIds.length) {
    return NextResponse.json({ error: 'One or more selected groups were not found or are no longer active.' }, { status: 404 })
  }

  interface ExecutionPlan {
    studentGroupId: string
    groupName: string
    currentAssignmentId: string | null
    nextPositionId: string
    nextTeacherClassAssignmentId: string
    currentActivityName: string | null
    nextActivityName: string
  }

  const results: GroupPreview[] = []
  const executionPlans: ExecutionPlan[] = []

  for (const group of groups) {
    // Each group's positions are its own — no longer shared with other groups.
    const positions = await db.carouselPosition.findMany({
      where: { studentGroupId: group.id, carouselPlanId: planId },
      orderBy: { positionOrder: 'asc' },
      include: {
        teacherClassAssignment: {
          include: { activityTemplate: { select: { name: true } }, teacherProfile: { select: { firstName: true, lastName: true } } },
        },
      },
    })
    if (positions.length === 0) {
      results.push({
        studentGroupId: group.id,
        groupName: group.name,
        currentActivity: null,
        currentTeacher: null,
        nextActivity: null,
        nextTeacher: null,
        earlyRotation: null,
        error: 'No carousel positions configured for this group.',
      })
      continue
    }

    const currentAssignment = await db.groupRotationAssignment.findFirst({
      where: { studentGroupId: group.id, status: RotationStatus.ACTIVE, carouselPosition: { carouselPlanId: planId } },
    })

    const engineState = {
      plan: { id: plan.id, schoolYearId: plan.schoolYearId, name: plan.name, isActive: plan.isActive },
      positions: positions.map((p) => ({
        id: p.id,
        carouselPlanId: p.carouselPlanId,
        positionOrder: p.positionOrder,
        teacherClassAssignmentId: p.teacherClassAssignmentId,
      })),
      currentAssignments: currentAssignment
        ? [{ id: currentAssignment.id, studentGroupId: group.id, carouselPositionId: currentAssignment.carouselPositionId, rotationNumber: currentAssignment.rotationNumber, status: currentAssignment.status }]
        : [],
      studentGroups: [{ id: group.id, name: group.name, schoolYearId: group.schoolYearId, gradeLevel: group.gradeLevel, gender: group.gender, isActive: group.isActive }],
    }

    const validation = validateCarouselRotation(engineState)
    if (!validation.isValid) {
      results.push({
        studentGroupId: group.id,
        groupName: group.name,
        currentActivity: null,
        currentTeacher: null,
        nextActivity: null,
        nextTeacher: null,
        earlyRotation: null,
        error: validation.errors.join('; '),
      })
      continue
    }

    const nextAssignments = computeNextRotationAssignments(engineState)
    const nextPositionId = nextAssignments.get(group.id)
    const nextPosition = positions.find((p) => p.id === nextPositionId)
    const currentPosition = currentAssignment ? positions.find((p) => p.id === currentAssignment.carouselPositionId) : null

    if (!nextPosition) {
      results.push({
        studentGroupId: group.id,
        groupName: group.name,
        currentActivity: currentPosition?.teacherClassAssignment.activityTemplate.name ?? null,
        currentTeacher: null,
        nextActivity: null,
        nextTeacher: null,
        earlyRotation: null,
        error: 'Could not determine the next position.',
      })
      continue
    }

    const earlyRotation = currentAssignment && currentAssignment.endDate > start ? { currentEndDate: currentAssignment.endDate } : null

    results.push({
      studentGroupId: group.id,
      groupName: group.name,
      currentActivity: currentPosition?.teacherClassAssignment.activityTemplate.name ?? null,
      currentTeacher: currentPosition
        ? `${currentPosition.teacherClassAssignment.teacherProfile.firstName} ${currentPosition.teacherClassAssignment.teacherProfile.lastName}`
        : null,
      nextActivity: nextPosition.teacherClassAssignment.activityTemplate.name,
      nextTeacher: `${nextPosition.teacherClassAssignment.teacherProfile.firstName} ${nextPosition.teacherClassAssignment.teacherProfile.lastName}`,
      earlyRotation,
    })

    executionPlans.push({
      studentGroupId: group.id,
      groupName: group.name,
      currentAssignmentId: currentAssignment?.id ?? null,
      nextPositionId: nextPosition.id,
      nextTeacherClassAssignmentId: nextPosition.teacherClassAssignmentId,
      currentActivityName: currentPosition?.teacherClassAssignment.activityTemplate.name ?? null,
      nextActivityName: nextPosition.teacherClassAssignment.activityTemplate.name,
    })
  }

  // Preview mode — return before/after for every selected group, execute nothing.
  if (!confirm) {
    return NextResponse.json({ data: { groups: results, message: 'Send confirm=true to execute this rotation.' } })
  }

  const blocked = results.filter((r) => r.earlyRotation && !r.error)
  if (blocked.length > 0 && !override) {
    return NextResponse.json(
      { earlyRotation: { groups: blocked.map((r) => ({ studentGroupId: r.studentGroupId, groupName: r.groupName, currentEndDate: r.earlyRotation!.currentEndDate })) } },
      { status: 409 },
    )
  }

  const userAgent = req.headers.get('user-agent') ?? undefined
  const rotated: Array<{ studentGroupId: string; groupName: string; rotationNumber: number }> = []
  const executionErrors: Array<{ studentGroupId: string; groupName: string; error: string }> = []

  for (const plan_ of executionPlans) {
   try {
    let nextRotationNumber = 1
    if (plan_.currentAssignmentId) {
      const currentAssignment = await db.groupRotationAssignment.findUnique({
        where: { id: plan_.currentAssignmentId },
        select: { rotationNumber: true },
      })
      // The current assignment existed moments ago when executionPlans was
      // built, but a concurrent request rotating the same group could have
      // already completed/removed it - fail this group cleanly instead of
      // crashing the whole request with an unhandled null-dereference.
      if (!currentAssignment) {
        throw new Error('This group\'s current rotation assignment no longer exists (it may have just been rotated by another request).')
      }
      nextRotationNumber = currentAssignment.rotationNumber + 1
    }

    // A group's next rotation may already be pre-scheduled as an UPCOMING
    // row — promote it instead of inserting a duplicate for the same
    // (studentGroupId, rotationNumber), which would violate the unique
    // constraint on GroupRotationAssignment.
    const preScheduled = await db.groupRotationAssignment.findFirst({
      where: { studentGroupId: plan_.studentGroupId, status: RotationStatus.UPCOMING, rotationNumber: nextRotationNumber },
      select: { id: true },
    })

    await db.$transaction(async (tx: TxClient) => {
      if (plan_.currentAssignmentId) {
        await tx.groupRotationAssignment.update({
          where: { id: plan_.currentAssignmentId },
          data: { status: RotationStatus.COMPLETED },
        })

        const endingInstances = await tx.historicalClassInstance.findMany({
          where: { groupRotationAssignmentId: plan_.currentAssignmentId, status: { not: RotationStatus.LOCKED } },
          select: { id: true },
        })

        await tx.historicalClassInstance.updateMany({
          where: { groupRotationAssignmentId: plan_.currentAssignmentId, status: { not: RotationStatus.LOCKED } },
          data: { status: RotationStatus.LOCKED, lockedAt: new Date(), lockedBy: session.user.id },
        })

        // Freeze each student's current grade into a fresh snapshot at the
        // moment their class locks, so the student's "My Classes" history
        // reflects exactly what existed then rather than a stale or
        // never-created snapshot (which happens if a teacher hadn't yet
        // entered all 4 standards when the rotation was executed).
        if (endingInstances.length > 0) {
          const members = await tx.studentGroupMembership.findMany({
            where: { studentGroupId: plan_.studentGroupId, leftAt: null },
            select: { studentProfileId: true },
          })
          for (const instance of endingInstances) {
            for (const member of members) {
              const hasAssessment = await tx.teacherAssessment.findFirst({
                where: { historicalClassInstanceId: instance.id, studentProfileId: member.studentProfileId },
                select: { id: true },
              })
              if (!hasAssessment) continue
              await createGradeSnapshot(tx, {
                studentProfileId: member.studentProfileId,
                historicalClassInstanceId: instance.id,
                schoolYearId: plan.schoolYearId,
              })
            }
          }
        }
      }

      const newAssignment = preScheduled
        ? await tx.groupRotationAssignment.update({
            where: { id: preScheduled.id },
            data: { carouselPositionId: plan_.nextPositionId, startDate: start, endDate: end, status: RotationStatus.ACTIVE },
          })
        : await tx.groupRotationAssignment.create({
            data: {
              schoolYearId: plan.schoolYearId,
              studentGroupId: plan_.studentGroupId,
              carouselPositionId: plan_.nextPositionId,
              startDate: start,
              endDate: end,
              status: RotationStatus.ACTIVE,
              rotationNumber: nextRotationNumber,
            },
          })

      await tx.historicalClassInstance.create({
        data: {
          groupRotationAssignmentId: newAssignment.id,
          studentGroupId: plan_.studentGroupId,
          teacherClassAssignmentId: plan_.nextTeacherClassAssignmentId,
          schoolYearId: plan.schoolYearId,
          status: RotationStatus.ACTIVE,
        },
      })

      await tx.rotationHistory.create({
        data: {
          carouselPlanId: planId,
          studentGroupId: plan_.studentGroupId,
          rotationNumber: nextRotationNumber,
          fromActivityName: plan_.currentActivityName,
          toActivityName: plan_.nextActivityName,
          executedBy: session.user.id,
          notes: notes ?? null,
        },
      })
    })

    await auditRotation({
      actorId: session.user.id,
      actorRole: session.user.role,
      carouselPlanId: planId,
      planName: plan.name,
      action: AuditAction.ROTATION_ADVANCED,
      notes: notes ? `${plan_.groupName}: ${notes}` : `${plan_.groupName}: ${plan_.currentActivityName ?? 'Unassigned'} → ${plan_.nextActivityName}`,
      ipAddress: ip,
      userAgent,
    })

    rotated.push({ studentGroupId: plan_.studentGroupId, groupName: plan_.groupName, rotationNumber: nextRotationNumber })
   } catch (err) {
    // One group failing to rotate (a race condition, a transient DB error,
    // etc.) must not crash the whole request and lose the groups that
    // already succeeded in this same loop - report it and move on.
    console.error(`[admin/carousel/rotate] Failed to rotate group ${plan_.groupName}:`, err)
    executionErrors.push({
      studentGroupId: plan_.studentGroupId,
      groupName: plan_.groupName,
      error: err instanceof Error ? err.message : 'Failed to rotate this group.',
    })
   }
  }

  return NextResponse.json({
    data: {
      rotated,
      errors: [
        ...results.filter((r) => r.error).map((r) => ({ studentGroupId: r.studentGroupId, groupName: r.groupName, error: r.error })),
        ...executionErrors,
      ],
      message: `${rotated.length} group${rotated.length !== 1 ? 's' : ''} rotated.`,
    },
  })
}
