import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Year at a Glance' }

export default async function MassGradingPage() {
  const session = await getServerSession(authOptions)!
  if (!session) return null

  const teacher = await db.teacherProfile.findUnique({ where: { userId: session.user.id } })
  if (!teacher) return <div className="p-6 text-gray-500">Teacher profile not found.</div>

  // Get teacher's active assignment to know which student group
  const activeAssignment = await db.groupRotationAssignment.findFirst({
    where: { teacherId: teacher.id, status: 'ACTIVE' },
    include: { studentGroup: true },
  })

  if (!activeAssignment) {
    return (
      <div className="p-6">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          No active class assignment. Year-at-a-glance requires an active assignment.
        </div>
      </div>
    )
  }

  // Get all rotation assignments for this student group in the current school year
  const allRotations = await db.groupRotationAssignment.findMany({
    where: { studentGroupId: activeAssignment.studentGroupId },
    include: {
      activityTemplate: true,
      teacher: { include: { teacherProfile: true } },
    },
    orderBy: { startDate: 'asc' },
  })

  // Get all students in the group
  const memberships = await db.studentGroupMembership.findMany({
    where: { groupId: activeAssignment.studentGroupId, leftAt: null },
    include: {
      student: {
        include: {
          gradeSnapshots: {
            include: { classInstance: { include: { rotationAssignment: true } } },
          },
        },
      },
    },
    orderBy: { student: { lastName: 'asc' } },
  })

  const students = memberships.map((m) => m.student)

  // Build grade lookup: studentId -> rotationAssignmentId -> snapshot
  type SnapKey = string
  const snapshotMap: Record<SnapKey, Record<string, typeof students[0]['gradeSnapshots'][0] | null>> = {}
  for (const student of students) {
    snapshotMap[student.id] = {}
    for (const snap of student.gradeSnapshots) {
      const rotId = snap.classInstance?.rotationAssignment?.id
      if (rotId) snapshotMap[student.id][rotId] = snap
    }
  }

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-blue-50',
    COMPLETED: 'bg-gray-50',
    LOCKED: 'bg-gray-100',
    UPCOMING: 'bg-white',
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Year at a Glance</h1>
      <p className="text-gray-500 text-sm mb-6">
        {activeAssignment.studentGroup.name} — All students × all class rotations
      </p>

      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left font-medium text-gray-600 border border-gray-200 sticky left-0 bg-gray-100 z-10 min-w-[140px]">
                Student
              </th>
              {allRotations.map((rot) => (
                <th
                  key={rot.id}
                  className={`px-3 py-2 text-center font-medium text-gray-600 border border-gray-200 min-w-[110px] ${statusColors[rot.status] ?? ''}`}
                >
                  <div>{rot.activityTemplate.name}</div>
                  <div className="text-xs font-normal text-gray-400">
                    {rot.status === 'UPCOMING' ? 'Upcoming' :
                     rot.status === 'ACTIVE' ? '▶ Active' :
                     rot.status === 'LOCKED' ? '🔒 Locked' : 'Done'}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium text-gray-600 border border-gray-200 bg-gray-100 sticky right-0 z-10">
                Overall
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const latestSnap = student.gradeSnapshots.sort(
                (a, b) => b.calculatedAt.getTime() - a.calculatedAt.getTime()
              )[0]

              return (
                <tr key={student.id} className="hover:bg-blue-50">
                  <td className="px-3 py-2 border border-gray-200 sticky left-0 bg-white z-10 font-medium text-gray-900">
                    {student.firstName} {student.lastName}
                  </td>
                  {allRotations.map((rot) => {
                    const snap = snapshotMap[student.id]?.[rot.id]
                    const isUpcoming = rot.status === 'UPCOMING'
                    const isActive = rot.status === 'ACTIVE'

                    return (
                      <td
                        key={rot.id}
                        className={`px-3 py-2 border border-gray-200 text-center ${statusColors[rot.status] ?? ''}`}
                      >
                        {isUpcoming ? (
                          <span className="text-gray-300">N/A</span>
                        ) : snap?.letterGrade ? (
                          <span className={`font-semibold ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>
                            {snap.letterGrade}
                          </span>
                        ) : isActive ? (
                          <span className="text-blue-400">—</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 border border-gray-200 text-center sticky right-0 bg-white z-10 font-bold text-gray-900">
                    {latestSnap?.letterGrade ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-blue-100 border border-blue-200 rounded"></span> Active (editable)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-gray-100 border border-gray-200 rounded"></span> Completed / Locked</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-white border border-gray-200 rounded"></span> Upcoming (N/A)</span>
      </div>
    </div>
  )
}
