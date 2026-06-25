import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'My Dashboard' }

export default async function StudentDashboard() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const student = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      gradeSnapshots: {
        orderBy: { calculatedAt: 'desc' },
        take: 1,
        include: {
          classInstance: {
            include: {
              rotationAssignment: {
                include: {
                  activityTemplate: true,
                  teacher: { include: { teacherProfile: true } },
                },
              },
            },
          },
        },
      },
      groups: {
        where: { leftAt: null },
        include: { group: true },
      },
    },
  })

  if (!student) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <h2 className="font-semibold text-yellow-800 mb-1">Profile Not Set Up</h2>
          <p className="text-yellow-700 text-sm">Your student profile hasn't been created yet. Contact your PE teacher or administrator.</p>
        </div>
      </div>
    )
  }

  const currentSnapshot = student.gradeSnapshots[0]
  const currentInstance = currentSnapshot?.classInstance
  const currentRotation = currentInstance?.rotationAssignment
  const currentTeacher = currentRotation?.teacher?.teacherProfile

  // Get all class instances for this student
  const allInstances = await db.historicalClassInstance.findMany({
    where: {
      rotationAssignment: {
        studentGroup: {
          memberships: {
            some: { studentId: student.id, leftAt: null },
          },
        },
      },
    },
    include: {
      rotationAssignment: {
        include: {
          activityTemplate: true,
          teacher: { include: { teacherProfile: true } },
        },
      },
      assessments: {
        where: { studentId: student.id },
        select: { standardNumber: true, writtenScore: true, notes: true, isStudentVisible: true },
      },
      gradeSnapshots: {
        where: { studentId: student.id },
        orderBy: { calculatedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { rotationAssignment: { startDate: 'asc' } },
  }).catch(() => [])

  const gradeColorClass: Record<string, string> = {
    A: 'bg-emerald-600', 'A-': 'bg-emerald-500',
    'B+': 'bg-blue-600', B: 'bg-blue-500', 'B-': 'bg-blue-400',
    'C+': 'bg-yellow-500', C: 'bg-yellow-400', 'C-': 'bg-orange-500',
    'D+': 'bg-orange-600', D: 'bg-red-500', 'D-': 'bg-red-600', F: 'bg-red-700',
  }

  const grade = currentSnapshot?.letterGrade
  const gradeBg = grade ? (gradeColorClass[grade] ?? 'bg-gray-500') : 'bg-gray-300'

  const scoreColor = (score: number | null) => {
    if (!score) return 'text-gray-400'
    if (score >= 3.5) return 'text-emerald-600'
    if (score >= 3) return 'text-green-600'
    if (score >= 2.5) return 'text-yellow-600'
    if (score >= 2) return 'text-orange-500'
    return 'text-red-600'
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Welcome, {student.firstName}!
      </h1>
      <p className="text-gray-500 text-sm mb-6">
        {student.groups[0]?.group.name ?? 'No group assigned'} · Grade {student.gradeLevel.replace('GRADE_', '')}
      </p>

      {/* Overall Grade hero */}
      <div className={`${gradeBg} text-white rounded-2xl p-6 mb-6 flex items-center gap-6`}>
        <div className="text-center">
          <div className="text-6xl font-black">{grade ?? '—'}</div>
          <div className="text-sm text-white/80 mt-1">Overall Grade</div>
        </div>
        <div className="flex-1">
          {currentRotation && (
            <div>
              <div className="font-semibold">{currentRotation.activityTemplate.name}</div>
              <div className="text-white/80 text-sm">
                {currentTeacher ? `${currentTeacher.firstName} ${currentTeacher.lastName}` : 'No teacher assigned'}
              </div>
            </div>
          )}
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Std 1', score: currentSnapshot?.standard1Score },
              { label: 'Std 2', score: currentSnapshot?.standard2Score },
              { label: 'Std 3', score: currentSnapshot?.standard3Score },
              { label: 'Std 4', score: currentSnapshot?.standard4Score },
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
          { num: 1, name: 'Movement Skills', score: currentSnapshot?.standard1Score },
          { num: 2, name: 'Movement Concepts & Sport Strategies', score: currentSnapshot?.standard2Score },
          { num: 3, name: 'Health, Fitness & Nutrition', score: currentSnapshot?.standard3Score },
          { num: 4, name: 'Teamwork & Leadership', score: currentSnapshot?.standard4Score },
        ].map(({ num, name, score }) => (
          <div key={num} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="text-xs font-medium text-gray-400 mb-1">Standard {num}</div>
            <div className="font-semibold text-gray-900 text-sm mb-2">{name}</div>
            <div className={`text-3xl font-bold ${scoreColor(score ?? null)}`}>
              {score?.toString() ?? '—'}
            </div>
            {score && (
              <div className={`text-xs mt-1 ${scoreColor(score)}`}>
                {score >= 3.5 ? 'Advanced' : score >= 3 ? 'Proficient' : score >= 2.5 ? 'Developing+' : score >= 2 ? 'Developing' : 'Beginning'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Teacher feedback */}
      {currentInstance?.assessments.filter((a) => a.isStudentVisible && a.notes).length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Teacher Feedback</h2>
          {currentInstance.assessments
            .filter((a) => a.isStudentVisible && a.notes)
            .map((a, i) => (
              <div key={i} className="p-3 bg-blue-50 rounded-lg mb-2 text-sm text-gray-700">
                <div className="text-xs text-blue-600 font-medium mb-1">
                  Standard {a.standardNumber}
                </div>
                {a.notes}
              </div>
            ))}
        </div>
      ) : null}

      {/* Class history */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">My Classes This Year</h2>
        <div className="space-y-2">
          {allInstances.map((inst) => {
            const snap = inst.gradeSnapshots[0]
            const isActive = inst.rotationAssignment.status === 'ACTIVE'
            const isUpcoming = inst.rotationAssignment.status === 'UPCOMING'
            return (
              <div key={inst.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 text-sm">
                <div>
                  <span className="font-medium">{inst.rotationAssignment.activityTemplate.name}</span>
                  <span className="text-gray-500 ml-2">
                    {inst.rotationAssignment.teacher?.teacherProfile
                      ? `${inst.rotationAssignment.teacher.teacherProfile.firstName} ${inst.rotationAssignment.teacher.teacherProfile.lastName}`
                      : ''}
                  </span>
                </div>
                <div>
                  {isUpcoming ? (
                    <span className="text-gray-400 text-xs">Upcoming</span>
                  ) : snap?.letterGrade ? (
                    <span className={`font-bold text-sm ${gradeColorClass[snap.letterGrade] ? 'text-' + gradeColorClass[snap.letterGrade].replace('bg-', '') : 'text-gray-700'}`}>
                      {snap.letterGrade}
                    </span>
                  ) : isActive ? (
                    <span className="text-blue-600 text-xs">In Progress</span>
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
