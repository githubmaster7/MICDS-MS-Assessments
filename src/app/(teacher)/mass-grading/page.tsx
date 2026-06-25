import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { MassGradingGrid } from '@/components/grading/MassGradingGrid'

export const metadata: Metadata = { title: 'Mass Grading Grid' }

export default async function MassGradingPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const teacher = await db.teacherProfile.findUnique({ where: { userId: session.user.id } })
  if (!teacher) return <div className="p-8 text-slate-500">Teacher profile not found.</div>

  const activeAssignment = await db.groupRotationAssignment.findFirst({
    where: { teacherId: teacher.id, status: 'ACTIVE' },
    include: { studentGroup: true },
  })

  if (!activeAssignment) {
    return (
      <div className="p-8">
        <div className="max-w-lg mx-auto bg-white border border-slate-200 rounded-xl p-8 text-center">
          <div className="text-3xl mb-4">📊</div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">No Active Assignment</h2>
          <p className="text-slate-500 text-sm">
            Year-at-a-glance view requires an active class assignment.
          </p>
        </div>
      </div>
    )
  }

  // All rotations for this group
  const allRotations = await db.groupRotationAssignment.findMany({
    where: { studentGroupId: activeAssignment.studentGroupId },
    include: { activityTemplate: true },
    orderBy: { startDate: 'asc' },
  })

  // All students in the group with their snapshots
  const memberships = await db.studentGroupMembership.findMany({
    where: { groupId: activeAssignment.studentGroupId, leftAt: null },
    include: {
      student: {
        include: {
          gradeSnapshots: {
            include: { classInstance: { include: { rotationAssignment: true } } },
            orderBy: { calculatedAt: 'desc' },
          },
        },
      },
    },
    orderBy: { student: { lastName: 'asc' } },
  })

  // Build data structures for the grid
  const rotationData = allRotations.map((rot: (typeof allRotations)[number], i: number) => ({
    id: rot.id,
    activityName: rot.activityTemplate.displayName,
    status: rot.status as 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'LOCKED',
    startDate: rot.startDate ? rot.startDate.toISOString() : null,
    endDate: rot.endDate ? rot.endDate.toISOString() : null,
    rotationNumber: i + 1,
  }))

  const studentData = memberships.map((m: (typeof memberships)[number]) => {
    const snaps = m.student.gradeSnapshots
    const latestSnap = snaps[0]

    // Build grade map per rotation
    const gradesByRotation: Record<string, string | null> = {}
    for (const rot of allRotations) {
      const snap = snaps.find((s: (typeof snaps)[number]) => s.classInstance?.rotationAssignment?.id === rot.id)
      gradesByRotation[rot.id] = snap?.letterGrade ?? null
    }

    return {
      id: m.student.id,
      firstName: m.student.firstName,
      lastName: m.student.lastName,
      currentGrade: latestSnap?.letterGrade ?? null,
      standard1Score: latestSnap?.standard1Score ? Number(latestSnap.standard1Score) : null,
      standard2Score: latestSnap?.standard2Score ? Number(latestSnap.standard2Score) : null,
      standard3Score: latestSnap?.standard3Score ? Number(latestSnap.standard3Score) : null,
      standard4Score: latestSnap?.standard4Score ? Number(latestSnap.standard4Score) : null,
      gradesByRotation,
    }
  })

  const gradedCount = studentData.filter((s: { currentGrade: string | null }) => s.currentGrade).length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mass Grading Grid</h1>
        <p className="text-slate-500 text-sm mt-1">
          {activeAssignment.studentGroup.name}
          {' · '}
          {studentData.length} students
          {' · '}
          {gradedCount} graded
          {' · '}
          {allRotations.length} rotations this year
        </p>
      </div>

      <MassGradingGrid
        rotations={rotationData}
        students={studentData}
      />
    </div>
  )
}
