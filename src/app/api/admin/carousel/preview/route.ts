import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role, RotationStatus } from '@prisma/client'
import { previewNextRotation } from '@/lib/carousel/engine'

type CarouselPosition = { id: string; carouselPlanId: string; positionOrder: number; teacherClassAssignmentId: string; teacherClassAssignment: { teacherProfile: { firstName: string; lastName: string }; activityTemplate: { name: string } } }
type StudentGroup = { id: string; name: string; schoolYearId: string; gradeLevel: string; gender: string; isActive: boolean }

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const planId = req.nextUrl.searchParams.get('planId')
  if (!planId) {
    return NextResponse.json({ error: 'planId query parameter is required.' }, { status: 400 })
  }

  const plan = await db.carouselPlan.findUnique({
    where: { id: planId },
    include: {
      positions: {
        orderBy: { positionOrder: 'asc' },
        include: {
          teacherClassAssignment: {
            include: {
              teacherProfile: { select: { id: true, firstName: true, lastName: true } },
              activityTemplate: { select: { name: true } },
            },
          },
        },
      },
      schoolYear: {
        include: {
          studentGroups: {
            where: { isActive: true },
          },
        },
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
    positions: (plan.positions as CarouselPosition[]).map((p) => ({
      id: p.id,
      carouselPlanId: p.carouselPlanId,
      positionOrder: p.positionOrder,
      teacherClassAssignmentId: p.teacherClassAssignmentId,
    })),
    currentAssignments,
    studentGroups: (plan.schoolYear.studentGroups as StudentGroup[]).map((g) => ({
      id: g.id,
      name: g.name,
      schoolYearId: g.schoolYearId,
      gradeLevel: g.gradeLevel,
      gender: g.gender,
      isActive: g.isActive,
    })),
  }

  const preview = previewNextRotation(engineState)

  // Enrich with human-readable names
  const groupMap = new Map((plan.schoolYear.studentGroups as StudentGroup[]).map((g) => [g.id, g.name]))
  interface PositionInfo { order: number; teacher: string; activity: string }
  const positionMap = new Map<string, PositionInfo>(
    (plan.positions as CarouselPosition[]).map((p) => [
      p.id,
      {
        order: p.positionOrder,
        teacher: `${p.teacherClassAssignment.teacherProfile.firstName} ${p.teacherClassAssignment.teacherProfile.lastName}`,
        activity: p.teacherClassAssignment.activityTemplate.name,
      } satisfies PositionInfo,
    ]),
  )

  const enrichMap = (map: Map<string, string[]>): Record<string, { groups: string[]; positionInfo: PositionInfo | null }> => {
    const result: Record<string, { groups: string[]; positionInfo: PositionInfo | null }> = {}
    for (const [posId, groupIds] of map.entries()) {
      result[posId] = {
        groups: (groupIds as string[]).map((gid: string) => groupMap.get(gid) ?? gid),
        positionInfo: positionMap.get(posId) ?? null,
      }
    }
    return result
  }

  return NextResponse.json({
    data: {
      ...preview,
      currentStateEnriched: enrichMap(preview.currentState),
      nextStateEnriched: enrichMap(preview.nextState),
    },
  })
}
