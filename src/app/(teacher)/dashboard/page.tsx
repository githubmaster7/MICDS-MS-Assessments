import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Teacher Dashboard' }

function GradeBar({ value, total }: { value: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100)
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular-nums text-slate-500 w-12 text-right text-xs">{value}/{total}</span>
    </div>
  )
}

const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  'A-': 'text-emerald-600 bg-emerald-50 border-emerald-200',
  'B+': 'text-blue-700 bg-blue-50 border-blue-200',
  B: 'text-blue-600 bg-blue-50 border-blue-200',
  'B-': 'text-blue-500 bg-blue-50 border-blue-200',
  'C+': 'text-amber-700 bg-amber-50 border-amber-200',
  C: 'text-amber-600 bg-amber-50 border-amber-200',
  'C-': 'text-orange-600 bg-orange-50 border-orange-200',
  'D+': 'text-orange-700 bg-orange-50 border-orange-200',
  D: 'text-red-600 bg-red-50 border-red-200',
  'D-': 'text-red-700 bg-red-50 border-red-200',
  F: 'text-red-800 bg-red-50 border-red-200',
}

function ScorePip({ score, label }: { score: number | null; label: string }) {
  const scoreColors: Record<string, string> = {
    '4': 'bg-emerald-500 text-white',
    '3.5': 'bg-green-400 text-white',
    '3': 'bg-green-300 text-green-900',
    '2.5': 'bg-yellow-300 text-yellow-900',
    '2': 'bg-yellow-200 text-yellow-800',
    '1.5': 'bg-orange-300 text-orange-900',
    '1': 'bg-red-400 text-white',
  }
  const key = score != null ? String(score) : ''
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold border ${
          score != null ? scoreColors[key] ?? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-100 text-slate-300 border-slate-200'
        }`}
      >
        {score ?? '—'}
      </div>
      <div className="text-[10px] text-slate-500 text-center leading-tight">{label}</div>
    </div>
  )
}

export default async function TeacherDashboard() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const teacher = await db.teacherProfile.findUnique({ where: { userId: session.user.id } })
  if (!teacher) {
    return (
      <div className="p-8">
        <div className="max-w-md mx-auto bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <div className="text-2xl mb-3">⚠️</div>
          <h2 className="font-semibold text-amber-900 mb-1">Profile Not Set Up</h2>
          <p className="text-amber-800 text-sm">Your teacher profile hasn't been created yet. Contact an administrator.</p>
        </div>
      </div>
    )
  }

  const activeInstance = await db.historicalClassInstance.findFirst({
    where: {
      status: 'ACTIVE',
      teacherClassAssignment: { teacherProfileId: teacher.id },
    },
    include: {
      studentGroup: {
        include: {
          memberships: { where: { leftAt: null }, include: { student: true } },
        },
      },
      teacherClassAssignment: {
        include: { activityTemplate: true },
      },
      groupRotationAssignment: true,
      teacherAssessments: {
        select: {
          id: true,
          studentProfileId: true,
          standard1Score: true,
          standard2Score: true,
          standard3Score: true,
          standard4Score: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
      },
    },
  })

  const upcomingAssignments = await db.groupRotationAssignment.findMany({
    where: {
      status: 'UPCOMING',
      carouselPosition: {
        teacherClassAssignment: { teacherProfileId: teacher.id },
      },
    },
    include: {
      studentGroup: true,
      carouselPosition: {
        include: { teacherClassAssignment: { include: { activityTemplate: true } } },
      },
    },
    orderBy: { startDate: 'asc' },
    take: 3,
  })

  const recentAssessments = await db.teacherAssessment.findMany({
    where: {
      teacherProfileId: teacher.id,
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
      classInstance: {
        include: {
          teacherClassAssignment: { include: { activityTemplate: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  })

  const studentCount = activeInstance?.studentGroup.memberships.length ?? 0
  const gradedCount = activeInstance?.teacherAssessments.length ?? 0
  const activity = activeInstance?.teacherClassAssignment.activityTemplate
  const rotation = activeInstance?.groupRotationAssignment

  // Compute average scores across graded students
  function avg(arr: (number | null)[]): number | null {
    const filtered = arr.filter((v): v is number => v != null)
    if (filtered.length === 0) return null
    return Math.round((filtered.reduce((a, b) => a + b, 0) / filtered.length) * 10) / 10
  }

  const assessments = activeInstance?.teacherAssessments ?? []
  const avgS1 = avg(assessments.map((a) => a.standard1Score ? Number(a.standard1Score) : null))
  const avgS2 = avg(assessments.map((a) => a.standard2Score ? Number(a.standard2Score) : null))
  const avgS3 = avg(assessments.map((a) => a.standard3Score ? Number(a.standard3Score) : null))
  const avgS4 = avg(assessments.map((a) => a.standard4Score ? Number(a.standard4Score) : null))

  const startDate = rotation?.startDate ? new Date(rotation.startDate) : null
  const endDate = rotation?.endDate ? new Date(rotation.endDate) : null

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight text-balance">
          Good morning, {teacher.firstName}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {activeInstance ? (
        <>
          {/* Current assignment card */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 mb-5 relative overflow-hidden">
            <div className="absolute inset-0 opacity-5" style={{
              backgroundImage: 'radial-gradient(circle at 80% 20%, #3b82f6 0%, transparent 60%)',
            }} />
            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1.5">Currently Teaching</div>
                  <h2 className="text-xl font-bold text-white mb-0.5">{activity?.displayName}</h2>
                  <p className="text-slate-300 text-sm">{activeInstance.studentGroup.name}</p>
                  {startDate && endDate && (
                    <p className="text-slate-500 text-xs mt-1">
                      {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
                      {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <Link
                  href="/(teacher)/grade"
                  className="shrink-0 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  Grade Now
                </Link>
              </div>

              {/* Progress */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-slate-300">Grading progress</span>
                  <span className="text-sm font-semibold text-white tabular-nums">
                    {gradedCount} / {studentCount} students
                  </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all"
                    style={{ width: studentCount > 0 ? `${(gradedCount / studentCount) * 100}%` : '0%' }}
                  />
                </div>
                {gradedCount < studentCount && (
                  <p className="text-slate-400 text-xs mt-1.5">{studentCount - gradedCount} students still need grades</p>
                )}
                {gradedCount === studentCount && studentCount > 0 && (
                  <p className="text-emerald-400 text-xs mt-1.5 font-medium">All students graded</p>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-4 mb-5 sm:grid-cols-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Avg S1</div>
              <ScorePip score={avgS1} label="Movement Skills" />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Avg S2</div>
              <ScorePip score={avgS2} label="Movement Concepts" />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Avg S3</div>
              <ScorePip score={avgS3} label="Health & Fitness" />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Avg S4</div>
              <ScorePip score={avgS4} label="Teamwork" />
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center mb-5">
          <div className="text-3xl mb-3">📋</div>
          <h3 className="font-semibold text-slate-700 mb-1">No Active Assignment</h3>
          <p className="text-slate-500 text-sm">You don't have an active class assignment right now.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Upcoming */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Upcoming Rotations</h3>
            <Link href="/(teacher)/upcoming" className="text-xs text-blue-600 hover:text-blue-700">View all</Link>
          </div>
          {upcomingAssignments.length === 0 ? (
            <p className="text-sm text-slate-400">No upcoming assignments scheduled.</p>
          ) : (
            <div className="space-y-2">
              {upcomingAssignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-slate-800">
                      {a.carouselPosition.teacherClassAssignment.activityTemplate.displayName}
                    </div>
                    <div className="text-xs text-slate-500">{a.studentGroup.name}</div>
                  </div>
                  <div className="text-xs text-slate-400 tabular-nums">
                    {a.startDate ? new Date(a.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent grading activity */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Recent Activity</h3>
            <Link href="/(teacher)/history" className="text-xs text-blue-600 hover:text-blue-700">History</Link>
          </div>
          {recentAssessments.length === 0 ? (
            <p className="text-sm text-slate-400">No grading activity yet.</p>
          ) : (
            <div className="space-y-2">
              {recentAssessments.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-slate-800">
                      {a.student.firstName} {a.student.lastName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {a.classInstance?.teacherClassAssignment.activityTemplate.displayName ?? '—'}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 tabular-nums">
                    {new Date(a.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
