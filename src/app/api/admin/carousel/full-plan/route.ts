import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role, RotationStatus } from '@prisma/client'

/**
 * Full-year rotation plan: every group's already-scheduled sequence of
 * teacher/activity pairings for the school year (rotationNumber 1..N),
 * covering both the currently ACTIVE rotation and every UPCOMING one that's
 * already been scheduled — not a projection, just the real stored plan.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const planId = req.nextUrl.searchParams.get('planId')
  if (!planId) {
    return NextResponse.json({ error: 'planId query parameter is required.' }, { status: 400 })
  }

  const plan = await db.carouselPlan.findUnique({ where: { id: planId }, select: { id: true, schoolYearId: true } })
  if (!plan) return NextResponse.json({ error: 'Carousel plan not found.' }, { status: 404 })

  const assignments = await db.groupRotationAssignment.findMany({
    where: {
      schoolYearId: plan.schoolYearId,
      status: { in: [RotationStatus.ACTIVE, RotationStatus.UPCOMING] },
      carouselPosition: { carouselPlanId: planId },
    },
    orderBy: [{ rotationNumber: 'asc' }],
    select: {
      rotationNumber: true,
      status: true,
      studentGroup: { select: { id: true, name: true, gradeLevel: true, gender: true } },
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
  })

  interface GroupPlan {
    groupId: string
    groupName: string
    gradeLevel: string
    gender: string
    steps: Array<{
      rotationNumber: number
      status: RotationStatus
      positionOrder: number
      teacher: string
      activity: string
    }>
  }

  const byGroup = new Map<string, GroupPlan>()
  for (const a of assignments) {
    let entry = byGroup.get(a.studentGroup.id)
    if (!entry) {
      entry = {
        groupId: a.studentGroup.id,
        groupName: a.studentGroup.name,
        gradeLevel: a.studentGroup.gradeLevel,
        gender: a.studentGroup.gender,
        steps: [],
      }
      byGroup.set(a.studentGroup.id, entry)
    }
    entry.steps.push({
      rotationNumber: a.rotationNumber,
      status: a.status,
      positionOrder: a.carouselPosition.positionOrder,
      teacher: `${a.carouselPosition.teacherClassAssignment.teacherProfile.firstName} ${a.carouselPosition.teacherClassAssignment.teacherProfile.lastName}`,
      activity: a.carouselPosition.teacherClassAssignment.activityTemplate.name,
    })
  }

  const data = [...byGroup.values()].sort((a, b) => a.groupName.localeCompare(b.groupName))

  return NextResponse.json({ data })
}
