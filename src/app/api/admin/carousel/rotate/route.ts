import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditRotation, AuditAction } from '@/lib/audit'
import { rotationLimiter, checkRateLimit, ipRateLimitKey } from '@/lib/rate-limit'
import { Role, RotationStatus } from '@prisma/client'
import { z } from 'zod'
import {
  previewNextRotation,
  computeNextRotationAssignments,
} from '@/lib/carousel/engine'

type CarouselPos = { id: string; carouselPlanId: string; positionOrder: number; teacherClassAssignmentId: string }
type StudentGrp = { id: string; name: string; schoolYearId: string; gradeLevel: string; gender: string; isActive: boolean }
type RotAssignment = { id: string; rotationNumber: number }

const RotateSchema = z.object({
  planId: z.string().uuid(),
  confirm: z.boolean().default(false),
  notes: z.string().max(1000).optional(),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
})

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

  const { planId, confirm, notes, startDate, endDate } = parsed.data

  const start = new Date(startDate)
  const end = new Date(endDate)
  if (end <= start) {
    return NextResponse.json({ error: 'endDate must be after startDate.' }, { status: 400 })
  }

  // Load the full carousel state
  const plan = await db.carouselPlan.findUnique({
    where: { id: planId },
    include: {
      positions: { orderBy: { positionOrder: 'asc' } },
      schoolYear: {
        include: { studentGroups: { where: { isActive: true } } },
      },
    },
  })

  if (!plan) return NextResponse.json({ error: 'Carousel plan not found.' }, { status: 404 })

  const currentAssignments = await db.groupRotationAssignment.findMany({
    where: {
      schoolYearId: plan.schoolYearId,
      status: { in: [RotationStatus.ACTIVE, RotationStatus.UPCOMING] },
      carouselPosition: { carouselPlanId: planId },
    },
    select: {
      id: true,
      studentGroupId: true,
      carouselPositionId: true,
      rotationNumber: true,
      status: true,
    },
  })

  const engineState = {
    plan: { id: plan.id, schoolYearId: plan.schoolYearId, name: plan.name, isActive: plan.isActive },
    positions: (plan.positions as CarouselPos[]).map((p) => ({
      id: p.id,
      carouselPlanId: p.carouselPlanId,
      positionOrder: p.positionOrder,
      teacherClassAssignmentId: p.teacherClassAssignmentId,
    })),
    currentAssignments,
    studentGroups: (plan.schoolYear.studentGroups as StudentGrp[]).map((g) => ({
      id: g.id,
      name: g.name,
      schoolYearId: g.schoolYearId,
      gradeLevel: g.gradeLevel,
      gender: g.gender,
      isActive: g.isActive,
    })),
  }

  const preview = previewNextRotation(engineState)

  if (!preview.isValid) {
    return NextResponse.json(
      { error: 'Carousel state is invalid and cannot be rotated.', details: preview.warnings },
      { status: 422 },
    )
  }

  // Preview mode — return before/after without executing
  if (!confirm) {
    return NextResponse.json({
      data: {
        preview,
        message: 'Send confirm=true to execute this rotation.',
      },
    })
  }

  // Execute rotation in a transaction
  const newAssignments = computeNextRotationAssignments(engineState)
  const nextRotationNumber =
    currentAssignments.length > 0
      ? Math.max(...(currentAssignments as RotAssignment[]).map((a) => a.rotationNumber)) + 1
      : 1

  const userAgent = req.headers.get('user-agent') ?? undefined

  await db.$transaction(async (tx: typeof db) => {
    // Mark current assignments as COMPLETED
    if (currentAssignments.length > 0) {
      await tx.groupRotationAssignment.updateMany({
        where: { id: { in: (currentAssignments as RotAssignment[]).map((a) => a.id) } },
        data: { status: RotationStatus.COMPLETED },
      })
    }

    // Create new GroupRotationAssignments
    const newAssignmentRecords = await Promise.all(
      Array.from(newAssignments.entries()).map(([studentGroupId, carouselPositionId]) =>
        tx.groupRotationAssignment.create({
          data: {
            schoolYearId: plan.schoolYearId,
            studentGroupId,
            carouselPositionId,
            startDate: start,
            endDate: end,
            status: RotationStatus.ACTIVE,
            rotationNumber: nextRotationNumber,
          },
        }),
      ),
    )

    // Find the teacher class assignment for each position to create HistoricalClassInstances
    const positionToTca = new Map(
      (plan.positions as CarouselPos[]).map((p) => [p.id, p.teacherClassAssignmentId]),
    )

    await Promise.all(
      newAssignmentRecords.map((assignment) => {
        const tcaId = positionToTca.get(assignment.carouselPositionId)
        if (!tcaId) return Promise.resolve()
        return tx.historicalClassInstance.create({
          data: {
            groupRotationAssignmentId: assignment.id,
            studentGroupId: assignment.studentGroupId,
            teacherClassAssignmentId: tcaId,
            schoolYearId: plan.schoolYearId,
            status: RotationStatus.UPCOMING,
          },
        })
      }),
    )

    // Create RotationHistory record
    await tx.rotationHistory.create({
      data: {
        carouselPlanId: planId,
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
    notes,
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({
    data: {
      rotationNumber: nextRotationNumber,
      groupsRotated: newAssignments.size,
      message: 'Rotation executed successfully.',
    },
  })
}
