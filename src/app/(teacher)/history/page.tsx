import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Teaching History' }

const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'A-': 'text-emerald-600 bg-emerald-50 border-emerald-200',
  'B+': 'text-blue-700 bg-blue-50 border-blue-200',
  B: 'text-blue-600 bg-blue-50 border-blue-200',
  'B-': 'text-blue-500 bg-blue-50 border-blue-200',
  'C+': 'text-amber-700 bg-amber-50 border-amber-200',
  C: 'text-amber-600 bg-amber-50 border-amber-200',
  'C-': 'text-orange-600 bg-orange-50 border-orange-200',
  D: 'text-red-600 bg-red-50 border-red-200',
  F: 'text-red-800 bg-red-100 border-red-200',
}

export default async function HistoryPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const teacher = await db.teacherProfile.findUnique({ where: { userId: session.user.id } })
  if (!teacher) return <div className="p-8 text-slate-500">Teacher profile not found.</div>

  const pastInstances = await db.historicalClassInstance.findMany({
    where: {
      status: { in: ['COMPLETED', 'LOCKED'] },
      teacherClassAssignment: { teacherProfileId: teacher.id },
    },
    include: {
      studentGroup: {
        include: { memberships: { where: { leftAt: null } } },
      },
      teacherClassAssignment: { include: { activityTemplate: true } },
      groupRotationAssignment: true,
      gradeSnapshots: {
        select: { letterGrade: true },
      },
      teacherAssessments: { select: { id: true } },
    },
    orderBy: { groupRotationAssignment: { endDate: 'desc' } },
  })

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Teaching History</h1>
        <p className="text-slate-500 text-sm mt-1">Completed rotations — read-only and locked.</p>
      </div>

      {pastInstances.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <div className="text-3xl mb-3">📚</div>
          <h3 className="font-semibold text-slate-700 mb-1">No History Yet</h3>
          <p className="text-slate-500 text-sm">Completed classes will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pastInstances.map((instance: (typeof pastInstances)[number]) => {
            const activity = instance.teacherClassAssignment.activityTemplate
            const rot = instance.groupRotationAssignment
            const snaps = instance.gradeSnapshots
            const studentCount = instance.studentGroup.memberships.length
            const gradedCount = instance.teacherAssessments.length

            // Grade distribution
            const dist: Record<string, number> = {}
            for (const snap of snaps) {
              if (snap.letterGrade) dist[snap.letterGrade] = (dist[snap.letterGrade] ?? 0) + 1
            }

            return (
              <div key={instance.id} className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-semibold text-slate-900">{activity.displayName}</h3>
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full border border-slate-200 shrink-0">
                        🔒 Locked
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">{instance.studentGroup.name}</p>
                    {rot && (
                      <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                        {rot.startDate ? new Date(rot.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '?'}
                        {' – '}
                        {rot.endDate ? new Date(rot.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '?'}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-medium text-slate-700 tabular-nums">{gradedCount}/{studentCount} graded</div>
                  </div>
                </div>

                {/* Grade distribution chips */}
                {Object.keys(dist).length > 0 && (
                  <div className="mt-3 flex gap-1.5 flex-wrap">
                    {Object.entries(dist)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([grade, count]) => (
                        <div
                          key={grade}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${GRADE_COLORS[grade] ?? 'text-slate-600 bg-slate-50 border-slate-200'}`}
                        >
                          <span>{grade}</span>
                          <span className="opacity-60">×{count}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
