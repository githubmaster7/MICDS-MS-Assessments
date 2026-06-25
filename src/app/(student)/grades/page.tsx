import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'My Grades — MICDS PE' }

const SCORE_LABEL: Record<string, string> = {
  '4': 'Advanced', '3.5': 'Proficient+', '3': 'Proficient',
  '2.5': 'Developing+', '2': 'Developing', '1.5': 'Beginning+', '1': 'Beginning',
}

function scoreColor(score: number | null): string {
  if (!score) return 'text-slate-300'
  if (score >= 3.5) return 'text-emerald-600'
  if (score >= 3)   return 'text-green-600'
  if (score >= 2.5) return 'text-amber-500'
  if (score >= 2)   return 'text-orange-500'
  return 'text-red-500'
}

function scoreBg(score: number | null): string {
  if (!score) return 'bg-slate-50 border-slate-200'
  if (score >= 3.5) return 'bg-emerald-50 border-emerald-200'
  if (score >= 3)   return 'bg-green-50 border-green-200'
  if (score >= 2.5) return 'bg-amber-50 border-amber-200'
  if (score >= 2)   return 'bg-orange-50 border-orange-200'
  return 'bg-red-50 border-red-200'
}

const GRADE_BG: Record<string, string> = {
  A: 'bg-emerald-500', 'A-': 'bg-emerald-400',
  'B+': 'bg-blue-500', B: 'bg-blue-500', 'B-': 'bg-blue-400',
  'C+': 'bg-amber-400', C: 'bg-amber-400', 'C-': 'bg-orange-400',
  'D+': 'bg-orange-500', D: 'bg-red-400', 'D-': 'bg-red-500', F: 'bg-red-600',
}

const STD_NAMES: Record<number, string> = {
  1: 'Movement Skills',
  2: 'Movement Concepts & Sport Strategies',
  3: 'Health, Fitness & Nutrition',
  4: 'Teamwork & Leadership',
}

const STD_ICONS = ['🏃', '🧠', '❤️', '🤝']

export default async function GradesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'STUDENT') redirect('/unauthorized')

  const student = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, firstName: true, lastName: true },
  })
  if (!student) return <div className="p-6 text-slate-500">Student profile not found.</div>

  // Get all grade snapshots for this student, one per instance
  const allSnapshots = await db.gradeCalculationSnapshot.findMany({
    where: { studentProfileId: student.id },
    orderBy: { calculatedAt: 'desc' },
    include: {
      historicalClassInstance: {
        include: {
          teacherClassAssignment: {
            include: {
              activityTemplate: { select: { name: true } },
              teacherProfile: { select: { firstName: true, lastName: true } },
            },
          },
          groupRotationAssignment: {
            select: { rotationNumber: true, startDate: true, endDate: true, status: true },
          },
        },
      },
    },
  })

  // De-dupe: latest snapshot per instance
  const seen = new Set<string>()
  const snapshots = allSnapshots.filter((s) => {
    if (seen.has(s.historicalClassInstanceId)) return false
    seen.add(s.historicalClassInstanceId)
    return true
  })

  // Visible teacher assessments per instance
  const visibleAssessments = await db.teacherAssessment.findMany({
    where: { studentProfileId: student.id, isFeedbackStudentVisible: true },
    select: {
      historicalClassInstanceId: true,
      standardNumber: true,
      feedback: true,
      score: true,
    },
  })

  const feedbackByInstance = new Map<string, typeof visibleAssessments>()
  for (const a of visibleAssessments) {
    const arr = feedbackByInstance.get(a.historicalClassInstanceId) ?? []
    arr.push(a)
    feedbackByInstance.set(a.historicalClassInstanceId, arr)
  }

  // Submissions per instance
  const submissions = await db.studentSubmission.findMany({
    where: { studentProfileId: student.id },
    select: {
      historicalClassInstanceId: true,
      standardNumber: true,
      status: true,
      honorCodeAcknowledgedAt: true,
    },
  })
  const submissionMap = new Map<string, typeof submissions>()
  for (const s of submissions) {
    const arr = submissionMap.get(s.historicalClassInstanceId) ?? []
    arr.push(s)
    submissionMap.set(s.historicalClassInstanceId, arr)
  }

  if (snapshots.length === 0) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-black text-slate-900 mb-6">My Grades</h1>
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-10 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📋</p>
          <p className="text-slate-500 font-medium">No grades yet</p>
          <p className="text-slate-400 text-sm mt-1">
            Your teacher hasn't graded any rotations yet. Check back soon!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-black text-slate-900">My Grades</h1>

      {snapshots.map((snap) => {
        const inst = snap.historicalClassInstance
        const tca = inst.teacherClassAssignment
        const gra = inst.groupRotationAssignment
        const activityName = tca.activityTemplate.name
        const teacherName = `${tca.teacherProfile.firstName} ${tca.teacherProfile.lastName}`
        const feedback = feedbackByInstance.get(snap.historicalClassInstanceId) ?? []
        const subs = submissionMap.get(snap.historicalClassInstanceId) ?? []
        const isActive = gra.status === 'ACTIVE'
        const gradeBg = snap.letterGrade ? (GRADE_BG[snap.letterGrade] ?? 'bg-slate-400') : 'bg-slate-300'

        const stdScores = [
          { num: 1, score: snap.standard1Score },
          { num: 2, score: snap.standard2Score },
          { num: 3, score: snap.standard3Score },
          { num: 4, score: snap.standard4Score },
        ]

        return (
          <div key={snap.historicalClassInstanceId} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Header bar */}
            <div className={cn('px-5 py-4 flex items-center justify-between gap-4', gradeBg)}>
              <div className="text-white">
                <p className="font-bold text-base">{activityName}</p>
                <p className="text-white/70 text-xs mt-0.5">
                  {teacherName}
                  {gra.startDate && gra.endDate && (
                    <span className="ml-2">
                      {new Date(gra.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      –
                      {new Date(gra.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {isActive && (
                  <span className="text-[10px] uppercase tracking-wider bg-white/20 text-white font-semibold px-2 py-0.5 rounded-full">
                    Current
                  </span>
                )}
                <div className="text-center">
                  <p className="text-3xl font-black text-white tabular-nums leading-none">
                    {snap.letterGrade ?? '—'}
                  </p>
                  <p className="text-[10px] text-white/60 mt-0.5">
                    {snap.overallAverage != null
                      ? `${(snap.overallAverage * 100).toFixed(1)}%`
                      : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Standard breakdown */}
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stdScores.map(({ num, score }) => (
                <div key={num} className={cn('rounded-xl border p-3', scoreBg(score))}>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-1">
                    {STD_ICONS[num - 1]} Std {num}
                  </p>
                  <p className="text-xs text-slate-500 leading-snug mb-2">
                    {STD_NAMES[num]}
                  </p>
                  {score != null ? (
                    <>
                      <p className={cn('text-2xl font-black tabular-nums', scoreColor(score))}>
                        {score}
                      </p>
                      <p className={cn('text-xs font-medium', scoreColor(score))}>
                        {SCORE_LABEL[String(score)] ?? ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-2xl font-black text-slate-200">—</p>
                  )}
                </div>
              ))}
            </div>

            {/* Written response status */}
            {subs.length > 0 && (
              <div className="px-4 pb-3">
                <p className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-2">
                  Written Submissions
                </p>
                <div className="flex flex-wrap gap-2">
                  {([2, 3, 4] as const).map((stdNum) => {
                    const sub = subs.find((s) => s.standardNumber === stdNum)
                    return (
                      <span
                        key={stdNum}
                        className={cn(
                          'text-xs font-medium px-2.5 py-1 rounded-full',
                          sub?.honorCodeAcknowledgedAt
                            ? 'bg-emerald-50 text-emerald-700'
                            : sub
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-400',
                        )}
                      >
                        Std {stdNum}:{' '}
                        {sub?.honorCodeAcknowledgedAt
                          ? 'Submitted'
                          : sub
                          ? 'Draft'
                          : 'Not started'}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Feedback */}
            {feedback.length > 0 && (
              <div className="px-4 pb-4 space-y-2">
                <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                  Teacher Feedback
                </p>
                {feedback.map((f, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 border border-slate-100">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                      Std {f.standardNumber} — {STD_NAMES[f.standardNumber]}
                    </span>
                    {f.feedback}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
