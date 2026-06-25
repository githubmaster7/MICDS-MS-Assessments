import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role, RotationStatus } from '@prisma/client'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.STUDENT) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const studentProfile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gradeLevel: true,
      gender: true,
      studentId: true,
    },
  })

  if (!studentProfile) {
    return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 })
  }

  // Current group membership
  const currentMembership = await db.studentGroupMembership.findFirst({
    where: { studentProfileId: studentProfile.id, leftAt: null },
    include: {
      studentGroup: {
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          gender: true,
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
              historicalClassInstances: {
                where: { status: { not: RotationStatus.LOCKED } },
                take: 1,
                select: { id: true, status: true },
              },
            },
          },
        },
      },
    },
  })

  // All submissions (with visible feedback only)
  const submissions = await db.studentSubmission.findMany({
    where: { studentProfileId: studentProfile.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      historicalClassInstance: {
        select: {
          id: true,
          status: true,
          teacherClassAssignment: {
            include: {
              activityTemplate: { select: { name: true } },
            },
          },
          groupRotationAssignment: {
            select: { rotationNumber: true, startDate: true, endDate: true },
          },
        },
      },
    },
  })

  // Grade snapshots (latest per instance)
  const instanceIds = [...new Set(submissions.map((s) => s.historicalClassInstanceId))]
  const snapshots = await db.gradeCalculationSnapshot.findMany({
    where: {
      studentProfileId: studentProfile.id,
      historicalClassInstanceId: { in: instanceIds },
    },
    orderBy: { calculatedAt: 'desc' },
    select: {
      historicalClassInstanceId: true,
      standard1Score: true,
      standard2Score: true,
      standard3Score: true,
      standard4Score: true,
      overallAverage: true,
      letterGrade: true,
      calculatedAt: true,
    },
  })

  // De-dupe snapshots: keep latest per instance
  const latestSnapshots = new Map<string, typeof snapshots[0]>()
  for (const snap of snapshots) {
    if (!latestSnapshots.has(snap.historicalClassInstanceId)) {
      latestSnapshots.set(snap.historicalClassInstanceId, snap)
    }
  }

  // Visible teacher feedback (only return feedback marked student-visible)
  const visibleAssessments = await db.teacherAssessment.findMany({
    where: {
      studentProfileId: studentProfile.id,
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
      submissions: submissions.map((s) => ({
        ...s,
        snapshot: latestSnapshots.get(s.historicalClassInstanceId) ?? null,
      })),
      visibleFeedback: visibleAssessments,
    },
  })
}
