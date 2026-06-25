import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Year at a Glance' }

export default async function MassGradingPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const teacher = await db.teacherProfile.findUnique({ where: { userId: session.user.id } })
  if (!teacher) return <div className="p-6 text-gray-500">Teacher profile not found.</div>

  // Find the active class instance for this teacher
  const activeInstance = await db.historicalClassInstance.findFirst({
    where: {
      status: 'ACTIVE',
      teacherClassAssignment: { teacherProfileId: teacher.id },
    },
    select: { studentGroupId: true, schoolYearId: true, studentGroup: { select: { name: true } } },
  })

  if (!activeInstance) {
    return (
      <div className="p-6">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          No active class assignment. Year-at-a-glance requires an active assignment.
        </div>
      </div>
    )
  }

  // All class instances for this student group in the same school year
  const allInstances = await db.historicalClassInstance.findMany({
    where: {
      studentGroupId: activeInstance.studentGroupId,
      schoolYearId: activeInstance.schoolYearId,
    },
    include: {
      teacherClassAssignment: {
        include: { activityTemplate: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // All students in the group
  const memberships = await db.studentGroupMembership.findMany({
    where: { studentGroupId: activeInstance.studentGroupId, leftAt: null },
    include: {
      studentProfile: true,
    },
    orderBy: { studentProfile: { lastName: 'asc' } },
  })

  const students = memberships.map((m) => m.studentProfile)

  // All grade snapshots for these students × these instances
  const studentIds = students.map((s) => s.id)
  const instanceIds = allInstances.map((i) => i.id)

  const snapshots = await db.gradeCalculationSnapshot.findMany({
    where: {
      studentProfileId: { in: studentIds },
      historicalClassInstanceId: { in: instanceIds },
    },
    orderBy: { calculatedAt: 'desc' },
  })

  // Build lookup: studentId -> instanceId -> snapshot
  const snapMap: Record<string, Record<string, typeof snapshots[0]>> = {}
  for (const snap of snapshots) {
    if (!snapMap[snap.studentProfileId]) snapMap[snap.studentProfileId] = {}
    if (!snapMap[snap.studentProfileId][snap.historicalClassInstanceId]) {
      snapMap[snap.studentProfileId][snap.historicalClassInstanceId] = snap
    }
  }

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-blue-50',
    LOCKED: 'bg-gray-100',
    UPCOMING: 'bg-white',
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Year at a Glance</h1>
      <p className="text-gray-500 text-sm mb-6">
        {activeInstance.studentGroup.name} — All students × all class rotations
      </p>

      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left font-medium text-gray-600 border border-gray-200 sticky left-0 bg-gray-100 z-10 min-w-[140px]">
                Student
              </th>
              {allInstances.map((inst) => (
                <th
                  key={inst.id}
                  className={`px-3 py-2 text-center font-medium text-gray-600 border border-gray-200 min-w-[110px] ${statusColors[inst.status] ?? ''}`}
                >
                  <div>{inst.teacherClassAssignment.activityTemplate.name}</div>
                  <div className="text-xs font-normal text-gray-400">
                    {inst.status === 'UPCOMING' ? 'Upcoming' :
                     inst.status === 'ACTIVE' ? '▶ Active' :
                     inst.status === 'LOCKED' ? '🔒 Locked' : inst.status}
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium text-gray-600 border border-gray-200 bg-gray-100 sticky right-0 z-10">
                Latest
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const studentSnaps = snapMap[student.id] ?? {}
              const latestSnap = snapshots
                .filter((s) => s.studentProfileId === student.id)
                .sort((a, b) => b.calculatedAt.getTime() - a.calculatedAt.getTime())[0]

              return (
                <tr key={student.id} className="hover:bg-blue-50">
                  <td className="px-3 py-2 border border-gray-200 sticky left-0 bg-white z-10 font-medium text-gray-900">
                    {student.firstName} {student.lastName}
                  </td>
                  {allInstances.map((inst) => {
                    const snap = studentSnaps[inst.id]
                    const isUpcoming = inst.status === 'UPCOMING'
                    const isActive = inst.status === 'ACTIVE'

                    return (
                      <td
                        key={inst.id}
                        className={`px-3 py-2 border border-gray-200 text-center ${statusColors[inst.status] ?? ''}`}
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
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-gray-100 border border-gray-200 rounded"></span> Locked</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-white border border-gray-200 rounded"></span> Upcoming (N/A)</span>
      </div>
    </div>
  )
}
