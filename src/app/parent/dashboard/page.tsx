import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Parent Dashboard' }

export default async function ParentDashboard({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const { studentId: qStudentId } = await searchParams

  const parent = await db.parentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      studentLinks: {
        include: {
          studentProfile: {
            include: {
              groupMemberships: {
                where: { leftAt: null },
                include: { studentGroup: true },
              },
            },
          },
        },
      },
    },
  })

  if (!parent || parent.studentLinks.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <h2 className="font-semibold text-yellow-800 mb-1">No Students Linked</h2>
          <p className="text-yellow-700 text-sm">No student accounts are linked to your parent profile. Contact the school administrator.</p>
        </div>
      </div>
    )
  }

  const students = parent.studentLinks.map((l) => l.studentProfile)
  const activeStudentId = qStudentId ?? students[0]?.id
  const student = students.find((s) => s.id === activeStudentId) ?? students[0]

  if (!student) return null

  // Get most recent grade snapshot for this student
  const currentSnapshot = await db.gradeCalculationSnapshot.findFirst({
    where: { studentProfileId: student.id },
    orderBy: { calculatedAt: 'desc' },
    include: {
      historicalClassInstance: {
        include: {
          teacherClassAssignment: {
            include: {
              activityTemplate: true,
              teacherProfile: true,
            },
          },
        },
      },
    },
  })

  const gradeColorClass: Record<string, string> = {
    A: 'bg-emerald-600', 'A-': 'bg-emerald-500',
    'B+': 'bg-blue-600', B: 'bg-blue-500', 'B-': 'bg-blue-400',
    'C+': 'bg-yellow-500', C: 'bg-yellow-400', 'C-': 'bg-orange-500',
    'D+': 'bg-orange-600', D: 'bg-red-500', 'D-': 'bg-red-600', F: 'bg-red-700',
  }

  const grade = currentSnapshot?.letterGrade
  const gradeBg = grade ? (gradeColorClass[grade] ?? 'bg-gray-500') : 'bg-gray-300'
  const currentActivity = currentSnapshot?.historicalClassInstance.teacherClassAssignment
  const currentTeacher = currentActivity?.teacherProfile
  const scoreVal = (d: unknown) => d != null ? Number(d) : null

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parent Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Read-only view</p>
        </div>
        {students.length > 1 && (
          <div className="flex gap-2">
            {students.map((s) => (
              <a
                key={s.id}
                href={`/parent/dashboard?studentId=${s.id}`}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${s.id === student.id ? 'bg-purple-700 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-purple-300'}`}
              >
                {s.firstName} {s.lastName}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6 text-sm text-purple-700">
        <strong>Viewing:</strong> {student.firstName} {student.lastName} · Grade {student.gradeLevel.replace('GRADE_', '')} · {student.groupMemberships[0]?.studentGroup.name ?? 'No group'}
      </div>

      <div className={`${gradeBg} text-white rounded-2xl p-6 mb-6 flex items-center gap-6`}>
        <div className="text-center">
          <div className="text-6xl font-black">{grade ?? '—'}</div>
          <div className="text-sm text-white/80 mt-1">Overall Grade</div>
        </div>
        <div className="flex-1">
          {currentActivity && (
            <div>
              <div className="font-semibold">{currentActivity.activityTemplate.name}</div>
              <div className="text-white/80 text-sm">
                {currentTeacher ? `${currentTeacher.firstName} ${currentTeacher.lastName}` : 'No teacher assigned'}
              </div>
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

      <div className="grid grid-cols-2 gap-4">
        {[
          { num: 1, name: 'Movement Skills', score: scoreVal(currentSnapshot?.standard1Score) },
          { num: 2, name: 'Movement Concepts & Sport Strategies', score: scoreVal(currentSnapshot?.standard2Score) },
          { num: 3, name: 'Health, Fitness & Nutrition', score: scoreVal(currentSnapshot?.standard3Score) },
          { num: 4, name: 'Teamwork & Leadership', score: scoreVal(currentSnapshot?.standard4Score) },
        ].map(({ num, name, score }) => (
          <div key={num} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs font-medium text-gray-400 mb-1">Standard {num}</div>
            <div className="font-semibold text-gray-900 text-sm mb-2">{name}</div>
            <div className={`text-3xl font-bold ${score ? 'text-gray-900' : 'text-gray-300'}`}>
              {score?.toString() ?? '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
