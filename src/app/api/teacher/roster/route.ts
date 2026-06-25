import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role, RotationStatus } from '@prisma/client'

type Membership = {
  studentGroupId: string
  studentProfile: { id: string; firstName: string; lastName: string; gradeLevel: string; studentId: string }
}
type Snapshot = {
  studentProfileId: string
  standard1Score: unknown; standard2Score: unknown; standard3Score: unknown; standard4Score: unknown
  overallAverage: unknown; letterGrade: string | null; calculatedAt: Date
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.TEACHER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })

  if (!teacherProfile) {
    return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 404 })
  }

  // Support optionally passing a groupId override (e.g. for history view)
  const groupId = req.nextUrl.searchParams.get('groupId')
  const instanceId = req.nextUrl.searchParams.get('instanceId')

  let studentGroupId: string

  if (groupId) {
    // Verify teacher is/was assigned to this group
    studentGroupId = groupId
  } else {
    // Find current active assignment
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
      select: { studentGroupId: true },
    })

    if (!assignment) {
      return NextResponse.json({ data: [], message: 'No active assignment found.' })
    }
    studentGroupId = assignment.studentGroupId
  }

  const memberships = await db.studentGroupMembership.findMany({
    where: {
      studentGroupId,
      leftAt: null,
    },
    orderBy: [{ studentProfile: { lastName: 'asc' } }, { studentProfile: { firstName: 'asc' } }],
    include: {
      studentProfile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          gradeLevel: true,
          gender: true,
          studentId: true,
        },
      },
    },
  })

  // If instanceId provided, attach per-student grade snapshot
  if (instanceId) {
    const studentIds = (memberships as Membership[]).map((m) => m.studentProfile.id)
    const snapshots = await db.gradeCalculationSnapshot.findMany({
      where: {
        historicalClassInstanceId: instanceId,
        studentProfileId: { in: studentIds },
      },
      select: {
        studentProfileId: true,
        standard1Score: true,
        standard2Score: true,
        standard3Score: true,
        standard4Score: true,
        overallAverage: true,
        letterGrade: true,
        calculatedAt: true,
      },
    })

    const snapshotMap = new Map((snapshots as Snapshot[]).map((s) => [s.studentProfileId, s]))

    return NextResponse.json({
      data: (memberships as Membership[]).map((m) => ({
        ...m,
        snapshot: snapshotMap.get(m.studentProfile.id) ?? null,
      })),
    })
  }

  return NextResponse.json({ data: memberships })
}
