import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey } from '@/lib/rate-limit'

const CreatePlanSchema = z.object({
  schoolYearId: z.string().uuid(),
  name: z.string().min(1).max(200),
  isActive: z.boolean().optional().default(false),
  positions: z
    .array(
      z.object({
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

  // Validate positions if provided
  if (positions && positions.length > 0) {
    const orders = positions.map((p) => p.positionOrder).sort((a, b) => a - b)
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i + 1) {
        return NextResponse.json({ error: 'Position orders must be contiguous starting at 1.' }, { status: 400 })
      }
    }

    // Validate teacher class assignments exist
    const tcaIds = positions.map((p) => p.teacherClassAssignmentId)
    const tcas = await db.teacherClassAssignment.findMany({
      where: { id: { in: tcaIds } },
      select: { id: true },
    })
    if (tcas.length !== tcaIds.length) {
      return NextResponse.json({ error: 'One or more teacher class assignments not found.' }, { status: 404 })
    }
  }

  const ip = ipRateLimitKey(req)

  const plan = await db.$transaction(async (tx: typeof db) => {
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
