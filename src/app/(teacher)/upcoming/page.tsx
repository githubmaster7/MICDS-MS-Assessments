import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'My Upcoming' }

export default async function UpcomingPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const teacher = await db.teacherProfile.findUnique({ where: { userId: session.user.id } })
  if (!teacher) return <div className="p-8 text-slate-500">Teacher profile not found.</div>

  const upcoming = await db.groupRotationAssignment.findMany({
    where: {
      status: 'UPCOMING',
      carouselPosition: {
        teacherClassAssignment: { teacherProfileId: teacher.id },
      },
    },
    include: {
      studentGroup: {
        include: { memberships: { where: { leftAt: null } } },
      },
      carouselPosition: {
        include: { teacherClassAssignment: { include: { activityTemplate: true } } },
      },
    },
    orderBy: { startDate: 'asc' },
  })

  const active = await db.groupRotationAssignment.findFirst({
    where: {
      status: 'ACTIVE',
      carouselPosition: {
        teacherClassAssignment: { teacherProfileId: teacher.id },
      },
    },
    include: {
      studentGroup: { include: { memberships: { where: { leftAt: null } } } },
      carouselPosition: {
        include: { teacherClassAssignment: { include: { activityTemplate: true } } },
      },
    },
  })

  function daysUntil(date: Date | null): string {
    if (!date) return '—'
    const diff = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    if (diff < 0) return 'Started'
    return `In ${diff} days`
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Upcoming</h1>
        <p className="text-slate-500 text-sm mt-1">Your scheduled class rotations.</p>
      </div>

      {/* Active now */}
      {active && (
        <div className="mb-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Active Now</div>
          <div className="bg-blue-700 text-white rounded-xl p-5">
            <div className="text-xs text-blue-300 mb-1">Currently in progress</div>
            <h3 className="font-semibold text-lg mb-0.5">
              {active.carouselPosition.teacherClassAssignment.activityTemplate.displayName}
            </h3>
            <p className="text-blue-200 text-sm">{active.studentGroup.name}</p>
            <p className="text-blue-300 text-xs mt-1 tabular-nums">
              {active.startDate ? new Date(active.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '?'}
              {' – '}
              {active.endDate ? new Date(active.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '?'}
            </p>
            <div className="mt-3 text-sm text-blue-200">
              {active.studentGroup.memberships.length} students
            </div>
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Upcoming Rotations
      </div>
      {upcoming.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <div className="text-3xl mb-3">📅</div>
          <h3 className="font-semibold text-slate-700 mb-1">No Upcoming Rotations</h3>
          <p className="text-slate-500 text-sm">Check back later — your schedule will appear here when it's been set.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.map((rot: (typeof upcoming)[number], i: number) => {
            const activity = rot.carouselPosition.teacherClassAssignment.activityTemplate
            const until = daysUntil(rot.startDate)
            const isNear = rot.startDate && (rot.startDate.getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000
            return (
              <div key={rot.id} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm shrink-0 tabular-nums">
                  {i + 1 + (active ? 1 : 0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-900">{activity.displayName}</div>
                  <div className="text-sm text-slate-500">{rot.studentGroup.name}</div>
                  {rot.startDate && (
                    <div className="text-xs text-slate-400 mt-0.5 tabular-nums">
                      {new Date(rot.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {rot.endDate && (
                        <> – {new Date(rot.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                      )}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className={`text-sm font-medium ${isNear ? 'text-amber-600' : 'text-slate-500'}`}>
                    {until}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {rot.studentGroup.memberships.length} students
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
