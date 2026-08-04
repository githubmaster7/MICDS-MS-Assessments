import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role, RotationStatus } from '@prisma/client'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.TEACHER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, firstName: true, lastName: true },
  })

  if (!teacherProfile) {
    return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 404 })
  }

  // Find the active GroupRotationAssignment for this teacher
  const assignment = await db.groupRotationAssignment.findFirst({
    where: {
      status: { in: [RotationStatus.ACTIVE, RotationStatus.UPCOMING] },
      carouselPosition: {
        teacherClassAssignment: {
          teacherProfileId: teacherProfile.id,
          isActive: true,
        },
      },
    },
    orderBy: { rotationNumber: 'desc' },
    include: {
      studentGroup: {
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          gender: true,
          _count: { select: { memberships: { where: { leftAt: null } } } },
        },
      },
      carouselPosition: {
        include: {
          teacherClassAssignment: {
            include: {
              activityTemplate: { select: { id: true, name: true, description: true } },
            },
          },
        },
      },
      historicalClassInstances: {
        where: { status: { not: RotationStatus.COMPLETED } },
        select: {
          id: true,
          status: true,
          lockedAt: true,
          createdAt: true,
        },
        take: 1,
      },
    },
  })

  if (!assignment) {
    return NextResponse.json({
      data: null,
      message: 'No active assignment found.',
    })
  }

  return NextResponse.json({
    data: {
      assignment: {
        id: assignment.id,
        rotationNumber: assignment.rotationNumber,
        startDate: assignment.startDate,
        endDate: assignment.endDate,
        status: assignment.status,
      },
      studentGroup: assignment.studentGroup,
      activity: assignment.carouselPosition.teacherClassAssignment.activityTemplate,
      classInstance: assignment.historicalClassInstances[0] ?? null,
      teacher: teacherProfile,
    },
  })
}
