import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role, RotationStatus } from '@prisma/client'

type ClassInstance = {
  id: string
  status: string
  studentGroupId: string
  studentGroup: { id: string; name: string; gradeLevel: string }
  teacherClassAssignment: { activityTemplate: { name: string } }
  groupRotationAssignment: { rotationNumber: number; startDate: Date; endDate: Date }
  createdAt: Date
}

/**
 * Year-at-a-glance grid.
 * Returns a matrix of students × rotations with per-cell grade state.
 *
 * Cell states:
 *   "locked"   – class instance is LOCKED, scores are final
 *   "editable" – teacher is currently assigned, grades can be changed
 *   "readonly" – teacher was assigned in a different rotation (read-only history)
 *   "na"       – student was not enrolled during this rotation
 */
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
  if (!teacherProfile) return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 404 })

  // Get all class instances this teacher has ever been assigned to
  const classInstances = await db.historicalClassInstance.findMany({
    where: {
      teacherClassAssignment: {
        teacherProfileId: teacherProfile.id,
      },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      studentGroup: { select: { id: true, name: true, gradeLevel: true } },
      teacherClassAssignment: {
        include: { activityTemplate: { select: { name: true } } },
      },
      groupRotationAssignment: { select: { rotationNumber: true, startDate: true, endDate: true } },
    },
  })

  if (classInstances.length === 0) {
    return NextResponse.json({ data: { columns: [], rows: [] } })
  }

  // Collect all student group IDs
  const groupIds = [...new Set((classInstances as ClassInstance[]).map((ci) => ci.studentGroupId))]

  // Get all students who were ever in these groups
  const memberships = await db.studentGroupMembership.findMany({
    where: { studentGroupId: { in: groupIds } },
    include: {
      studentProfile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          gradeLevel: true,
          studentId: true,
        },
      },
    },
  })

  // Get all grade snapshots for this teacher's instances
  const instanceIds = (classInstances as ClassInstance[]).map((ci) => ci.id)
  const snapshots = await db.gradeCalculationSnapshot.findMany({
    where: { historicalClassInstanceId: { in: instanceIds } },
    orderBy: { calculatedAt: 'desc' },
    select: {
      studentProfileId: true,
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

  // Build lookup: instanceId+studentId → latest snapshot
  const snapshotKey = (instanceId: string, studentId: string) => `${instanceId}|${studentId}`
  const snapshotMap = new Map<string, typeof snapshots[0]>()
  for (const snap of snapshots) {
    const key = snapshotKey(snap.historicalClassInstanceId, snap.studentProfileId)
    if (!snapshotMap.has(key)) {
      snapshotMap.set(key, snap) // Already ordered by desc, first = latest
    }
  }

  // Build student set (unique)
  const studentMap = new Map<string, { id: string; firstName: string; lastName: string; gradeLevel: string; studentId: string }>()
  for (const m of memberships) {
    studentMap.set(m.studentProfile.id, m.studentProfile)
  }

  // Determine current active instance id for editability
  const activeInstance = (classInstances as ClassInstance[]).find(
    (ci) => ci.status === RotationStatus.ACTIVE || ci.status === RotationStatus.UPCOMING,
  )

  // Build grid columns (one per instance)
  const columns = (classInstances as ClassInstance[]).map((ci) => ({
    instanceId: ci.id,
    rotationNumber: ci.groupRotationAssignment.rotationNumber,
    startDate: ci.groupRotationAssignment.startDate,
    endDate: ci.groupRotationAssignment.endDate,
    activity: ci.teacherClassAssignment.activityTemplate.name,
    group: ci.studentGroup,
    status: ci.status,
    isActive: ci.id === activeInstance?.id,
  }))

  // Membership lookup: groupId+studentId → boolean (was member during rotation)
  const membershipByGroup = new Map<string, Set<string>>()
  for (const m of memberships) {
    const existing = membershipByGroup.get(m.studentGroupId) ?? new Set()
    existing.add(m.studentProfile.id)
    membershipByGroup.set(m.studentGroupId, existing)
  }

  // Build grid rows (one per student)
  const students = Array.from(studentMap.values()).sort((a, b) =>
    `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`),
  )

  const rows = students.map((student) => {
    const cells = (classInstances as ClassInstance[]).map((ci) => {
      const groupMembers = membershipByGroup.get(ci.studentGroupId)
      if (!groupMembers?.has(student.id)) {
        return { instanceId: ci.id, state: 'na' as const, snapshot: null }
      }

      const snapshot = snapshotMap.get(snapshotKey(ci.id, student.id)) ?? null

      let state: 'locked' | 'editable' | 'readonly'
      if (ci.status === RotationStatus.LOCKED) {
        state = 'locked'
      } else if (ci.id === activeInstance?.id) {
        state = 'editable'
      } else {
        state = 'readonly'
      }

      return {
        instanceId: ci.id,
        state,
        snapshot: snapshot
          ? {
              standard1Score: snapshot.standard1Score,
              standard2Score: snapshot.standard2Score,
              standard3Score: snapshot.standard3Score,
              standard4Score: snapshot.standard4Score,
              overallAverage: snapshot.overallAverage,
              letterGrade: snapshot.letterGrade,
            }
          : null,
      }
    })

    return { student, cells }
  })

  return NextResponse.json({ data: { columns, rows } })
}
