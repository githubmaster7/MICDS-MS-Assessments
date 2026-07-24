import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Teaching History' }

export default async function TeacherHistoryPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null
  const teacher = await db.teacherProfile.findUnique({ where: { userId: session.user.id } })
  if (!teacher) return <div className="p-6 text-gray-500">Teacher profile not found.</div>

  // Past class instances taught by this teacher
  const pastInstances = await db.historicalClassInstance.findMany({
    where: {
      status: 'LOCKED',
      teacherClassAssignment: { teacherProfileId: teacher.id },
    },
    include: {
      teacherClassAssignment: {
        include: { activityTemplate: true },
      },
      studentGroup: {
        include: { memberships: { where: { leftAt: null } } },
      },
      teacherAssessments: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Teaching History</h1>
      <p className="text-sm text-gray-500 mb-4">Read-only. Completed rotations are locked.</p>
      {pastInstances.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No completed classes yet.
        </div>
      ) : (
        <div className="space-y-4">
          {pastInstances.map((inst) => (
            <div key={inst.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{inst.teacherClassAssignment.activityTemplate.name}</h3>
                  <p className="text-sm text-gray-500">{inst.studentGroup.name}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">{inst.studentGroup.memberships.length} students</div>
                  <div className="text-xs text-gray-400">{inst.teacherAssessments.length} grades recorded</div>
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
