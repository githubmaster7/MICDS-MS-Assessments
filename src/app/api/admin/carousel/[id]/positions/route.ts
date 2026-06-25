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

const ReorderSchema = z.object({
  positions: z.array(
    z.object({
      positionId: z.string().uuid(),
      positionOrder: z.number().int().min(1),
    }),
  ).min(1),
})

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const { id } = await params

  const plan = await db.carouselPlan.findUnique({ where: { id }, select: { id: true } })
  if (!plan) return NextResponse.json({ error: 'Carousel plan not found.' }, { status: 404 })

  const positions = await db.carouselPosition.findMany({
    where: { carouselPlanId: id },
    orderBy: { positionOrder: 'asc' },
    include: {
      teacherClassAssignment: {
        include: {
          teacherProfile: { select: { id: true, firstName: true, lastName: true } },
          activityTemplate: { select: { id: true, name: true } },
        },
      },
      _count: { select: { groupRotationAssignments: true } },
    },
  })

  return NextResponse.json({ data: positions })
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

  const parsed = ReorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { positions } = parsed.data

  const plan = await db.carouselPlan.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!plan) return NextResponse.json({ error: 'Carousel plan not found.' }, { status: 404 })

  // Verify all positionIds belong to this plan
  const existingPositions = await db.carouselPosition.findMany({
    where: { carouselPlanId: id },
    select: { id: true, positionOrder: true },
  })

  const existingIds = new Set(existingPositions.map((p) => p.id))
  for (const pos of positions) {
    if (!existingIds.has(pos.positionId)) {
      return NextResponse.json(
        { error: `Position not found in this plan.` },
        { status: 400 },
      )
    }
  }

  if (positions.length !== existingPositions.length) {
    return NextResponse.json(
      { error: 'All positions must be included in the reorder.' },
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

  await db.$transaction(
    positions.map((pos) =>
      db.carouselPosition.update({
        where: { id: pos.positionId },
        data: { positionOrder: pos.positionOrder },
      }),
    ),
  )

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.CAROUSEL_PLAN_UPDATED,
    targetType: 'CarouselPlan',
    targetId: id,
    targetLabel: plan.name,
    afterValue: { reordered: positions },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  const updated = await db.carouselPosition.findMany({
    where: { carouselPlanId: id },
    orderBy: { positionOrder: 'asc' },
  })

  return NextResponse.json({ data: updated })
}
