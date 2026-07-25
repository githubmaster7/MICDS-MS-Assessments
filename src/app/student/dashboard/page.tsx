import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'


type ClassInst = {
  id: string
  status: string
  gradeSnapshots: {
    letterGrade?: string | null
    standard1Score?: unknown
    standard2Score?: unknown
    standard3Score?: unknown
    standard4Score?: unknown
    historicalClassInstanceId: string
  }[]
  teacherClassAssignment: {
    activityTemplate: { name: string }
    teacherProfile: { firstName: string; lastName: string }
  }
}

export const metadata: Metadata = { title: 'My Dashboard' }

export default async function StudentDashboard() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const student = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      groupMemberships: {
        where: { leftAt: null },
        include: { studentGroup: true },
      },
    },
  })

  if (!student) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <h2 className="font-semibold text-yellow-800 mb-1">Profile Not Set Up</h2>
          <p className="text-yellow-700 text-sm">Your student profile hasn&apos;t been created yet. Contact your PE teacher or administrator.</p>
        </div>
      </div>
    )
  }

  // Get all class instances for this student's group
  const groupId = student.groupMemberships[0]?.studentGroup.id
  const allInstances = groupId ? await db.historicalClassInstance.findMany({
    where: { studentGroupId: groupId },
    include: {
      teacherClassAssignment: {
        include: {
          activityTemplate: true,
          teacherProfile: true,
        },
      },
      gradeSnapshots: {
        where: { studentProfileId: student.id },
        orderBy: { calculatedAt: 'desc' },
        take: 1,
      },
      teacherAssessments: {
        where: { studentProfileId: student.id, isFeedbackStudentVisible: true },
        select: { standardNumber: true, feedback: true, isFeedbackStudentVisible: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  }).catch(() => []) : []

  const gradeColorClass: Record<string, string> = {
    A: 'bg-emerald-600', 'A-': 'bg-emerald-500',
    'B+': 'bg-blue-600', B: 'bg-blue-500', 'B-': 'bg-blue-400',
    'C+': 'bg-yellow-500', C: 'bg-yellow-400', 'C-': 'bg-orange-500',
    'D+': 'bg-orange-600', D: 'bg-red-500', 'D-': 'bg-red-600', F: 'bg-red-700',
  }

  // The student's actual current class is whichever rotation is ACTIVE right
  // now — not whichever class happens to have the most recent grade snapshot
  // (that could still be a prior, fully-graded rotation while the new one is
  // still in progress and ungraded). The hero grade/standards MUST come from
  // that same active instance's own snapshot — pulling the globally most
  // recent snapshot instead would show a past class's grade under the
  // current class's name whenever the active class hasn't been graded yet.
  const activeInstance = (allInstances as ClassInst[]).find((i) => i.status === 'ACTIVE')
  const currentSnapshot = activeInstance?.gradeSnapshots[0] ?? null
  const currentActivity = activeInstance?.teacherClassAssignment
  const currentTeacher = currentActivity?.teacherProfile

  const grade = currentSnapshot?.letterGrade
  const gradeBg = grade ? (gradeColorClass[grade] ?? 'bg-gray-500') : 'bg-gray-300'

  const scoreVal = (d: unknown) => d != null ? Number(d) : null

  const scoreColor = (score: number | null) => {
    if (!score) return 'text-gray-400'
    if (score >= 4) return 'text-score-exceeding-text'
    if (score >= 3.5) return 'text-score-achieving-text'
    if (score >= 3) return 'text-score-achieving-text'
    if (score >= 2.5) return 'text-score-developing-text'
    if (score >= 2) return 'text-score-developing-text'
    return 'text-score-incomplete-text'
  }

  // Teacher feedback for current class
  const currentInstanceId = currentSnapshot?.historicalClassInstanceId
  const currentInstance = allInstances.find(i => i.id === currentInstanceId)
  const visibleFeedback = currentInstance?.teacherAssessments.filter(a => a.isFeedbackStudentVisible && a.feedback) ?? []

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader
        variant="primary"
        title={<>Welcome, {student.firstName}!</>}
        description={
          <>
            {student.groupMemberships[0]?.studentGroup.name ?? 'No group assigned'} · Grade {student.gradeLevel.replace('GRADE_', '')}
          </>
        }
      />

      {/* Overall Grade hero */}
      <div className={`${gradeBg} text-white rounded-2xl p-6 mb-6 flex items-center gap-6`}>
        <div className="text-center">
          <div className="text-6xl font-black">{grade ?? '—'}</div>
          <div className="text-sm text-white/80 mt-1">Overall Grade</div>
        </div>
        <div className="flex-1">
          {currentActivity && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{currentActivity.activityTemplate.name}</div>
                <div className="text-white/80 text-sm">
                  {currentTeacher ? `${currentTeacher.firstName} ${currentTeacher.lastName}` : 'No teacher assigned'}
                </div>
              </div>
              {activeInstance && (
                <Link
                  href={`/student/submit/${activeInstance.id}`}
                  className="shrink-0 bg-white/20 hover:bg-white/30 transition-colors text-white text-sm font-medium px-4 py-2 rounded-lg"
                >
                  Submit Work
                </Link>
              )}
            </div>
          )}
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Std 1', score: scoreVal(currentSnapshot?.standard1Score) },
              { label: 'Std 2', score: scoreVal(currentSnapshot?.standard2Score) },
              { label: 'Std 3', score: scoreVal(currentSnapshot?.standard3Score) },
              { label: 'Std 4', score: scoreVal(currentSnapshot?.standard4Score) },
            ].map(({ label, score }) => (
              <div key={label} className="bg-white/20 rounded-lg p-2">
                <div className="text-xs text-white/70">{label}</div>
                <div className="text-lg font-bold">{score?.toString() ?? '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Standard cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { num: 1, name: 'Movement Skills', score: scoreVal(currentSnapshot?.standard1Score) },
          { num: 2, name: 'Movement Concepts & Sport Strategies', score: scoreVal(currentSnapshot?.standard2Score) },
          { num: 3, name: 'Health, Fitness & Nutrition', score: scoreVal(currentSnapshot?.standard3Score) },
          { num: 4, name: 'Teamwork & Leadership', score: scoreVal(currentSnapshot?.standard4Score) },
        ].map(({ num, name, score }) => (
          <div key={num} className="bg-white rounded-xl border border-primary-200 p-5">
            <div className="text-xs font-medium text-gray-400 mb-1">Standard {num}</div>
            <div className="font-semibold text-gray-900 text-sm mb-2">{name}</div>
            <div className={`text-3xl font-bold ${scoreColor(score)}`}>
              {score?.toString() ?? '—'}
            </div>
            {score && (
              <div className={`text-xs mt-1 ${scoreColor(score)}`}>
                {score >= 4 ? 'Exceeding' : score >= 3.5 ? 'Achieving+' : score >= 3 ? 'Achieving' : score >= 2.5 ? 'Developing+' : score >= 2 ? 'Developing' : 'Incomplete'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Teacher feedback */}
      {visibleFeedback.length > 0 && (
        <div className="bg-white rounded-xl border border-primary-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Teacher Feedback</h2>
          {visibleFeedback.map((a, i) => (
            <div key={i} className="p-3 bg-primary-50 rounded-lg mb-2 text-sm text-gray-700">
              <div className="text-xs text-primary-900 font-medium mb-1">Standard {a.standardNumber}</div>
              {a.feedback}
            </div>
          ))}
        </div>
      )}

      {/* Class history */}
      <div className="bg-white rounded-xl border border-primary-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">My Classes This Year</h2>
        <div className="space-y-2">
          {(allInstances as ClassInst[]).map((inst) => {
            const snap = inst.gradeSnapshots[0]
            const isActive = inst.status === 'ACTIVE'
            const isUpcoming = inst.status === 'UPCOMING'
            return (
              <div key={inst.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-100 text-sm">
                <div>
                  <span className="font-medium">{inst.teacherClassAssignment.activityTemplate.name}</span>
                  <span className="text-gray-500 ml-2">
                    {`${inst.teacherClassAssignment.teacherProfile.firstName} ${inst.teacherClassAssignment.teacherProfile.lastName}`}
                  </span>
                </div>
                <div>
                  {isUpcoming ? (
                    <span className="text-gray-400 text-xs">Upcoming</span>
                  ) : snap?.letterGrade ? (
                    <span className="font-bold text-sm text-gray-700">{snap.letterGrade}</span>
                  ) : isActive ? (
                    <span className="text-primary-900 text-xs">In Progress</span>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </div>
              </div>
            )
          })}
          {allInstances.length === 0 && (
            <p className="text-gray-400 text-sm">No classes yet this year.</p>
          )}
        </div>
      </div>
    </div>
  )
}
