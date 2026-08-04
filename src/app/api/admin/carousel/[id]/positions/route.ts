import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, type TxClient } from '@/lib/db'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { Role, RotationStatus } from '@prisma/client'
import { z } from 'zod'
import { computeUpcomingSequence } from '@/lib/carousel/engine'
import { ipRateLimitKey, rotationLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

// [id] here is a studentGroupId — positions are scoped per group, so
// reordering (and its contiguous-ordering constraint) applies within one
// group's own carousel, never across groups.
interface RouteParams {
  params: Promise<{ id: string }>
}

const ReorderSchema = z.object({
  positions: z.array(
    z.object({
      positionId: z.string().uuid(),
      positionOrder: z.number().int().min(1),
    }),
  ).min(1),
})

const CreatePositionsSchema = z.object({
  planId: z.string().uuid(),
  teacherClassAssignmentIds: z.array(z.string().uuid()).min(1, 'Select at least one teacher/class for the first position.'),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }),
})

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { id: studentGroupId } = await params

  const group = await db.studentGroup.findUnique({ where: { id: studentGroupId }, select: { id: true } })
  if (!group) return NextResponse.json({ error: 'Student group not found.' }, { status: 404 })

  const positions = await db.carouselPosition.findMany({
    where: { studentGroupId },
    orderBy: { positionOrder: 'asc' },
    include: {
      teacherClassAssignment: {
        include: {
          teacherProfile: { select: { id: true, firstName: true, lastName: true } },
          activityTemplate: { select: { id: true, name: true } },
        },
      },
      groupRotationAssignments: { where: { status: 'ACTIVE' }, select: { id: true } },
      _count: { select: { groupRotationAssignments: true } },
    },
  })

  return NextResponse.json({ data: positions })
}

export async function PUT(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const rl = await checkRateLimit(rotationLimiter, userRateLimitKey(session.user.id))
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.msBeforeNext / 1000)) } },
    )
  }

  const { id: studentGroupId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = ReorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { positions } = parsed.data

  const group = await db.studentGroup.findUnique({ where: { id: studentGroupId }, select: { id: true, name: true } })
  if (!group) return NextResponse.json({ error: 'Student group not found.' }, { status: 404 })

  // Verify all positionIds belong to this group
  const existingPositions = await db.carouselPosition.findMany({
    where: { studentGroupId },
    select: { id: true, positionOrder: true },
  })

  const existingIds = new Set(existingPositions.map((p: { id: string; positionOrder: number }) => p.id))
  for (const pos of positions) {
    if (!existingIds.has(pos.positionId)) {
      return NextResponse.json(
        { error: `Position not found in this group's carousel.` },
        { status: 400 },
      )
    }
  }

  if (positions.length !== existingPositions.length) {
    return NextResponse.json(
      { error: "All of this group's positions must be included in the reorder." },
      { status: 400 },
    )
  }

  // Validate contiguous ordering
  const orders = positions.map((p) => p.positionOrder).sort((a, b) => a - b)
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      return NextResponse.json({ error: 'Position orders must be contiguous starting at 1.' }, { status: 400 })
    }
  }

  const ip = ipRateLimitKey(req)

  // (studentGroupId, positionOrder) is unique, so writing final values in one
  // pass can collide mid-transaction (e.g. swapping #1 and #2 tries to set
  // #1 to 2 while #2 still holds 2). Stage every row through a negative
  // sentinel first — guaranteed distinct from any real order — then apply
  // the final values in a second pass.
  await db.$transaction([
    ...positions.map((pos, idx) =>
      db.carouselPosition.update({
        where: { id: pos.positionId },
        data: { positionOrder: -(idx + 1) },
      }),
    ),
    ...positions.map((pos) =>
      db.carouselPosition.update({
        where: { id: pos.positionId },
        data: { positionOrder: pos.positionOrder },
      }),
    ),
  ])

  const updated = await db.carouselPosition.findMany({
    where: { studentGroupId },
    orderBy: { positionOrder: 'asc' },
  })

  // Eagerly re-sync this group's pre-scheduled UPCOMING rotations to the new
  // order, so the admin's full-plan view, the teacher's upcoming-classes
  // list, and the student's My Classes page all reflect the reorder right
  // away — they read GroupRotationAssignment.carouselPositionId directly,
  // and without this it would only take visible effect once /rotate
  // actually reaches each future rotation number.
  let resyncedCount = 0
  const activeAssignment = await db.groupRotationAssignment.findFirst({
    where: { studentGroupId, status: RotationStatus.ACTIVE },
    select: { carouselPositionId: true },
  })

  if (activeAssignment) {
    const upcoming = await db.groupRotationAssignment.findMany({
      where: { studentGroupId, status: RotationStatus.UPCOMING },
      orderBy: { rotationNumber: 'asc' },
      select: { id: true },
    })

    if (upcoming.length > 0) {
      const sequence = computeUpcomingSequence(updated, activeAssignment.carouselPositionId, upcoming.length)
      await db.$transaction(
        upcoming.map((assignment, idx) =>
          db.groupRotationAssignment.update({
            where: { id: assignment.id },
            data: { carouselPositionId: sequence[idx] },
          }),
        ),
      )
      resyncedCount = upcoming.length
    }
  }

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.CAROUSEL_PLAN_UPDATED,
    targetType: 'StudentGroup',
    targetId: studentGroupId,
    targetLabel: group.name,
    afterValue: { reordered: positions, upcomingRotationsResynced: resyncedCount },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: updated })
}

// Bootstraps the initial carousel positions + first ACTIVE rotation for a
// group that has none yet (a brand-new StudentGroup). Reorder (PUT) and
// /rotate both require positions to already exist, so this is the only way
// to get a new group's rotation off the ground.
export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const rl = await checkRateLimit(rotationLimiter, userRateLimitKey(session.user.id))
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.msBeforeNext / 1000)) } },
    )
  }

  const { id: studentGroupId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = CreatePositionsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { planId, teacherClassAssignmentIds, startDate, endDate } = parsed.data
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (end <= start) {
    return NextResponse.json({ error: 'endDate must be after startDate.' }, { status: 400 })
  }

  const group = await db.studentGroup.findUnique({ where: { id: studentGroupId }, select: { id: true, name: true, schoolYearId: true } })
  if (!group) return NextResponse.json({ error: 'Student group not found.' }, { status: 404 })

  const existingCount = await db.carouselPosition.count({ where: { studentGroupId } })
  if (existingCount > 0) {
    return NextResponse.json(
      { error: 'This group already has carousel positions configured. Use reorder or rotate instead.' },
      { status: 409 },
    )
  }

  const plan = await db.carouselPlan.findUnique({ where: { id: planId } })
  if (!plan) return NextResponse.json({ error: 'Carousel plan not found.' }, { status: 404 })

  const assignments = await db.teacherClassAssignment.findMany({
    where: { id: { in: teacherClassAssignmentIds }, isActive: true },
    select: { id: true },
  })
  if (assignments.length !== teacherClassAssignmentIds.length) {
    return NextResponse.json({ error: 'One or more teacher/class assignments were not found or are no longer active.' }, { status: 400 })
  }

  const durationMs = end.getTime() - start.getTime()
  const ip = ipRateLimitKey(req)

  const created = await db.$transaction(async (tx: TxClient) => {
    const positions: Array<{ id: string; positionOrder: number; carouselPlanId: string; studentGroupId: string | null; teacherClassAssignmentId: string }> = []
    for (let i = 0; i < teacherClassAssignmentIds.length; i++) {
      positions.push(
        await tx.carouselPosition.create({
          data: {
            carouselPlanId: planId,
            studentGroupId,
            positionOrder: i + 1,
            teacherClassAssignmentId: teacherClassAssignmentIds[i],
          },
        }),
      )
    }

    const firstAssignment = await tx.groupRotationAssignment.create({
      data: {
        schoolYearId: group.schoolYearId,
        studentGroupId,
        carouselPositionId: positions[0].id,
        startDate: start,
        endDate: end,
        status: RotationStatus.ACTIVE,
        rotationNumber: 1,
      },
    })

    await tx.historicalClassInstance.create({
      data: {
        groupRotationAssignmentId: firstAssignment.id,
        studentGroupId,
        teacherClassAssignmentId: teacherClassAssignmentIds[0],
        schoolYearId: group.schoolYearId,
        status: RotationStatus.ACTIVE,
      },
    })

    let cursorEnd = end
    for (let i = 1; i < positions.length; i++) {
      const rotStart = cursorEnd
      const rotEnd = new Date(rotStart.getTime() + durationMs)
      await tx.groupRotationAssignment.create({
        data: {
          schoolYearId: group.schoolYearId,
          studentGroupId,
          carouselPositionId: positions[i].id,
          startDate: rotStart,
          endDate: rotEnd,
          status: RotationStatus.UPCOMING,
          rotationNumber: i + 1,
        },
      })
      cursorEnd = rotEnd
    }

    return positions
  })

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.GROUP_ROTATION_ASSIGNED,
    targetType: 'StudentGroup',
    targetId: studentGroupId,
    targetLabel: group.name,
    afterValue: { planId, positionCount: created.length, teacherClassAssignmentIds },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: created })
}
