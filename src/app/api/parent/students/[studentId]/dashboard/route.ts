import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { requireParentStudentLink } from '@/lib/authorization'
import { Role, RotationStatus } from '@prisma/client'

interface RouteParams {
  params: Promise<{ studentId: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.PARENT) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { studentId } = await params

  try {
    await requireParentStudentLink(session.user.id, studentId)
  } catch {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const studentProfile = await db.studentProfile.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gradeLevel: true,
      gender: true,
      studentId: true,
    },
  })
  if (!studentProfile) return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 })

  // Current group/rotation
  const currentMembership = await db.studentGroupMembership.findFirst({
    where: { studentProfileId: studentId, leftAt: null },
    include: {
      studentGroup: {
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          groupRotationAssignments: {
            where: { status: { in: [RotationStatus.ACTIVE, RotationStatus.UPCOMING] } },
            take: 1,
            include: {
              carouselPosition: {
                include: {
                  teacherClassAssignment: {
                    include: {
                      activityTemplate: { select: { name: true } },
                      teacherProfile: { select: { firstName: true, lastName: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  // Grade snapshots (latest per instance — all history)
  const snapshots = await db.gradeCalculationSnapshot.findMany({
    where: { studentProfileId: studentId },
    orderBy: { calculatedAt: 'desc' },
    include: {
      historicalClassInstance: {
        select: {
          id: true,
          status: true,
          teacherClassAssignment: {
            include: { activityTemplate: { select: { name: true } } },
          },
          groupRotationAssignment: {
            select: { rotationNumber: true, startDate: true, endDate: true },
          },
        },
      },
    },
  })

  // De-dupe: latest snapshot per instance
  const seenInstances = new Set<string>()
  const latestSnapshots = snapshots.filter((s: { historicalClassInstanceId: string; historicalClassInstance: { teacherClassAssignment: { activityTemplate: { name: string } }; groupRotationAssignment: { rotationNumber: number; startDate: Date; endDate: Date }; status: string }; standard1Score: unknown; standard2Score: unknown; standard3Score: unknown; standard4Score: unknown; overallAverage: unknown; letterGrade: string | null; atlScore: unknown; calculatedAt: Date }) => {
    if (seenInstances.has(s.historicalClassInstanceId)) return false
    seenInstances.add(s.historicalClassInstanceId)
    return true
  })

  // Visible teacher feedback only
  const visibleFeedback = await db.teacherAssessment.findMany({
    where: {
      studentProfileId: studentId,
      isFeedbackStudentVisible: true,
    },
    select: {
      historicalClassInstanceId: true,
      standardNumber: true,
      feedback: true,
      score: true,
      assessedAt: true,
    },
  })

  return NextResponse.json({
    data: {
      profile: studentProfile,
      currentAssignment: currentMembership
        ? {
            group: currentMembership.studentGroup,
            activeRotation: currentMembership.studentGroup.groupRotationAssignments[0] ?? null,
          }
        : null,
      gradeHistory: latestSnapshots.map((s: { historicalClassInstanceId: string; historicalClassInstance: { teacherClassAssignment: { activityTemplate: { name: string } }; groupRotationAssignment: { rotationNumber: number; startDate: Date; endDate: Date }; status: string }; standard1Score: unknown; standard2Score: unknown; standard3Score: unknown; standard4Score: unknown; overallAverage: unknown; letterGrade: string | null; atlScore: unknown; calculatedAt: Date }) => ({
        instanceId: s.historicalClassInstanceId,
        activity: s.historicalClassInstance.teacherClassAssignment.activityTemplate.name,
        rotationNumber: s.historicalClassInstance.groupRotationAssignment.rotationNumber,
        startDate: s.historicalClassInstance.groupRotationAssignment.startDate,
        endDate: s.historicalClassInstance.groupRotationAssignment.endDate,
        instanceStatus: s.historicalClassInstance.status,
        standard1Score: s.standard1Score,
        standard2Score: s.standard2Score,
        standard3Score: s.standard3Score,
        standard4Score: s.standard4Score,
        overallAverage: s.overallAverage,
        letterGrade: s.letterGrade,
        calculatedAt: s.calculatedAt,
      })),
      visibleFeedback,
    },
  })
}
