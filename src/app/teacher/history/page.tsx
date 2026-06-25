import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Teaching History' }

export default async function TeacherHistoryPage() {
  const session = await getServerSession(authOptions)!
  if (!session) return null
  const teacher = await db.teacherProfile.findUnique({ where: { userId: session.user.id } })
  if (!teacher) return <div className="p-6 text-gray-500">Teacher profile not found.</div>

  const pastAssignments = await db.groupRotationAssignment.findMany({
    where: { teacherId: teacher.id, status: { in: ['COMPLETED', 'LOCKED'] } },
    include: {
      studentGroup: {
        include: { memberships: { where: { leftAt: null } } },
      },
      activityTemplate: true,
      historicalInstance: {
        include: { assessments: { select: { id: true } } },
      },
    },
    orderBy: { endDate: 'desc' },
  })

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Teaching History</h1>
      <p className="text-sm text-gray-500 mb-4">Read-only. Completed rotations are locked.</p>
      {pastAssignments.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No completed classes yet.
        </div>
      ) : (
        <div className="space-y-4">
          {pastAssignments.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{a.activityTemplate.name}</h3>
                  <p className="text-sm text-gray-500">{a.studentGroup.name}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {a.startDate ? new Date(a.startDate).toLocaleDateString() : '?'} –{' '}
                    {a.endDate ? new Date(a.endDate).toLocaleDateString() : '?'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">{a.studentGroup.memberships.length} students</div>
                  <div className="text-xs text-gray-400">{a.historicalInstance?.assessments.length ?? 0} grades recorded</div>
                  <span className="inline-flex px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs mt-1">🔒 Locked</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
