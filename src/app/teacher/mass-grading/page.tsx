import { Metadata } from 'next'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Year at a Glance' }

export default async function MassGradingPage({
  searchParams,
}: {
  searchParams: Promise<{ instanceId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const teacher = await db.teacherProfile.findUnique({ where: { userId: session.user.id } })
  if (!teacher) return <div className="p-6 text-gray-500">Teacher profile not found.</div>

  // A teacher can have more than one simultaneously-ACTIVE class when they
  // teach multiple groups at once — fetch all of them so "Year at a Glance"
  // can be viewed for any of them, not just whichever one comes back first.
  // Also include any LOCKED class an admin has reopened for this teacher's
  // regrading, matching /teacher/grade/students.
  const availableInstances = await db.historicalClassInstance.findMany({
    where: {
      teacherClassAssignment: { teacherProfileId: teacher.id },
      OR: [
        { status: 'ACTIVE' },
        { status: 'LOCKED', regradeGrants: { some: { teacherRegradeEnabled: true, closedAt: null } } },
      ],
    },
    select: {
      id: true,
      status: true,
      studentGroupId: true,
      schoolYearId: true,
      studentGroup: { select: { name: true } },
      teacherClassAssignment: { select: { activityTemplate: { select: { name: true } } } },
    },
    orderBy: { studentGroup: { name: 'asc' } },
  })

  if (availableInstances.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          No active class assignment, and no locked class currently reopened for you.
        </div>
      </div>
    )
  }

  const { instanceId } = await searchParams
  const activeInstance = availableInstances.find((i) => i.id === instanceId) ?? availableInstances[0]

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

  // Future rotations don't get a HistoricalClassInstance row until they
  // actually start, but the year-at-a-glance grid must still show them
  // (as N/A) so teachers can see the whole year, not just what's happened.
  const upcomingRotations = await db.groupRotationAssignment.findMany({
    where: {
      studentGroupId: activeInstance.studentGroupId,
      schoolYearId: activeInstance.schoolYearId,
      status: 'UPCOMING',
    },
    include: {
      carouselPosition: {
        include: { teacherClassAssignment: { include: { activityTemplate: true } } },
      },
    },
    orderBy: { rotationNumber: 'asc' },
  })

  type Column =
    | { kind: 'instance'; id: string; activityName: string; status: string }
    | { kind: 'upcoming'; id: string; activityName: string }

  const columns: Column[] = [
    ...allInstances.map((inst): Column => ({
      kind: 'instance',
      id: inst.id,
      activityName: inst.teacherClassAssignment.activityTemplate.name,
      status: inst.status,
    })),
    ...upcomingRotations.map((rot): Column => ({
      kind: 'upcoming',
      id: rot.id,
      activityName: rot.carouselPosition.teacherClassAssignment.activityTemplate.name,
    })),
  ]

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
      <p className="text-gray-500 text-sm mb-4">
        {activeInstance.studentGroup.name} — All students × all class rotations
      </p>

      {availableInstances.length > 1 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {availableInstances.map((inst) => (
            <Link
              key={inst.id}
              href={`/teacher/mass-grading?instanceId=${inst.id}`}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                inst.id === activeInstance.id
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
              }`}
            >
              {inst.teacherClassAssignment.activityTemplate.name} · {inst.studentGroup.name}
              {inst.status === 'LOCKED' && ' 🔓'}
            </Link>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left font-medium text-gray-600 border border-gray-200 sticky left-0 bg-gray-100 z-10 min-w-[140px]">
                Student
              </th>
              {columns.map((col) => (
                <th
                  key={col.id}
                  className={`px-3 py-2 text-center font-medium text-gray-600 border border-gray-200 min-w-[110px] ${col.kind === 'instance' ? statusColors[col.status] ?? '' : statusColors.UPCOMING}`}
                >
                  <div>{col.activityName}</div>
                  <div className="text-xs font-normal text-gray-400">
                    {col.kind === 'upcoming' ? 'Upcoming' :
                     col.status === 'ACTIVE' ? '▶ Active' :
                     col.status === 'LOCKED' ? '🔒 Locked' : col.status}
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
                  {columns.map((col) => {
                    if (col.kind === 'upcoming') {
                      return (
                        <td key={col.id} className="px-3 py-2 border border-gray-200 text-center bg-white">
                          <span className="text-gray-300">N/A</span>
                        </td>
                      )
                    }
                    const snap = studentSnaps[col.id]
                    const isActive = col.status === 'ACTIVE'

                    return (
                      <td
                        key={col.id}
                        className={`px-3 py-2 border border-gray-200 text-center ${statusColors[col.status] ?? ''}`}
                      >
                        {snap?.letterGrade ? (
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
