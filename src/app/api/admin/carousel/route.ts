import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, type TxClient } from '@/lib/db'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { canAssignActivityToGroup } from '@/lib/enrollment'
import { ipRateLimitKey, rotationLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

const CreatePlanSchema = z.object({
  schoolYearId: z.string().uuid(),
  name: z.string().min(1).max(200),
  isActive: z.boolean().optional().default(false),
  positions: z
    .array(
      z.object({
        studentGroupId: z.string().uuid(),
        positionOrder: z.number().int().min(1),
        teacherClassAssignmentId: z.string().uuid(),
      }),
    )
    .min(1)
    .optional(),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { searchParams } = req.nextUrl
  const schoolYearId = searchParams.get('schoolYearId')

  const where: Record<string, unknown> = {}
  if (schoolYearId) where.schoolYearId = schoolYearId

  const plans = await db.carouselPlan.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      schoolYear: { select: { id: true, name: true } },
      positions: {
        orderBy: { positionOrder: 'asc' },
        include: {
          teacherClassAssignment: {
            include: {
              teacherProfile: { select: { id: true, firstName: true, lastName: true } },
              activityTemplate: { select: { id: true, name: true } },
            },
          },
        },
      },
      _count: { select: { rotationHistories: true } },
    },
  })

  return NextResponse.json({ data: plans })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = CreatePlanSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid input.' },
      { status: 400 },
    )
  }

  const { schoolYearId, name, isActive, positions } = parsed.data

  const schoolYear = await db.schoolYear.findUnique({ where: { id: schoolYearId }, select: { id: true } })
  if (!schoolYear) return NextResponse.json({ error: 'School year not found.' }, { status: 404 })

  const existing = await db.carouselPlan.findUnique({
    where: { schoolYearId_name: { schoolYearId, name } },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: 'A carousel plan with this name already exists.' }, { status: 409 })
  }

  // Validate positions if provided — position order is contiguous per group,
  // since each group now has its own independent carousel.
  if (positions && positions.length > 0) {
    const byGroup = new Map<string, number[]>()
    for (const p of positions) {
      const list = byGroup.get(p.studentGroupId) ?? []
      list.push(p.positionOrder)
      byGroup.set(p.studentGroupId, list)
    }
    for (const orders of byGroup.values()) {
      orders.sort((a, b) => a - b)
      for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== i + 1) {
          return NextResponse.json({ error: 'Position orders must be contiguous starting at 1 within each group.' }, { status: 400 })
        }
      }
    }

    const groupIds = Array.from(byGroup.keys())
    const tcaIds = positions.map((p) => p.teacherClassAssignmentId)
    const [groupsFound, tcas] = await Promise.all([
      db.studentGroup.findMany({ where: { id: { in: groupIds } }, select: { id: true, gender: true, gradeLevel: true } }),
      db.teacherClassAssignment.findMany({
        where: { id: { in: tcaIds } },
        select: { id: true, activityTemplate: { select: { name: true, gender: true, gradeLevel: true } } },
      }),
    ])
    if (groupsFound.length !== groupIds.length) {
      return NextResponse.json({ error: 'One or more student groups not found.' }, { status: 404 })
    }
    if (tcas.length !== new Set(tcaIds).size) {
      return NextResponse.json({ error: 'One or more teacher class assignments not found.' }, { status: 404 })
    }

    const groupById = new Map(groupsFound.map((g) => [g.id, g]))
    const tcaById = new Map(tcas.map((t) => [t.id, t]))
    for (const p of positions) {
      const group = groupById.get(p.studentGroupId)!
      const tca = tcaById.get(p.teacherClassAssignmentId)!
      const compat = canAssignActivityToGroup(tca.activityTemplate, group)
      if (!compat.allowed) {
        return NextResponse.json(
          { error: `"${tca.activityTemplate.name}" can't be added to this group — ${compat.reason}.` },
          { status: 400 },
        )
      }
    }
  }

  const ip = ipRateLimitKey(req)

  const plan = await db.$transaction(async (tx: TxClient) => {
    const created = await tx.carouselPlan.create({
      data: {
        schoolYearId,
        name,
        isActive: isActive ?? false,
        createdBy: session.user.id,
      },
    })

    if (positions && positions.length > 0) {
      await tx.carouselPosition.createMany({
        data: positions.map((p) => ({
          carouselPlanId: created.id,
          studentGroupId: p.studentGroupId,
          positionOrder: p.positionOrder,
          teacherClassAssignmentId: p.teacherClassAssignmentId,
        })),
      })
    }

    return created
  })

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.CAROUSEL_PLAN_CREATED,
    targetType: 'CarouselPlan',
    targetId: plan.id,
    targetLabel: name,
    afterValue: { schoolYearId, name, isActive, positionCount: positions?.length ?? 0 },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: plan }, { status: 201 })
}
