import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IndividualGradeView } from './IndividualGradeView'

export const metadata: Metadata = { title: 'Student Grading' }

export default async function StudentGradePage({
  params,
}: {
  params: { studentId: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const teacher = await db.teacherProfile.findUnique({ where: { userId: session.user.id } })
  if (!teacher) return <div className="p-8 text-slate-500">Teacher profile not found.</div>

  const activeInstance = await db.historicalClassInstance.findFirst({
    where: {
      status: 'ACTIVE',
      teacherClassAssignment: { teacherProfileId: teacher.id },
    },
    include: {
      studentGroup: {
        include: {
          memberships: {
            where: { leftAt: null },
            include: { student: true },
          },
        },
      },
      teacherClassAssignment: { include: { activityTemplate: true } },
    },
  })

  if (!activeInstance) notFound()
  // TS narrowing helper — notFound() throws but TS doesn't know
  const instance = activeInstance!

  const membership = instance.studentGroup.memberships.find(
    (m: { student: { id: string } }) => m.student.id === params.studentId
  )
  if (!membership) notFound()
  const membershipSafe = membership!

  const student = membershipSafe.student

  // Load existing assessment data
  const assessment = await db.teacherAssessment.findFirst({
    where: {
      studentProfileId: params.studentId,
      classInstanceId: instance.id,
    },
    include: {
      skillScores: true,
      feedbackItems: true,
    },
  })

  const skillMap: Record<string, 1 | 2 | 3 | 4> = {}
  for (const s of assessment?.skillScores ?? []) {
    skillMap[s.skillId] = s.score as 1 | 2 | 3 | 4
  }

  // Previous students / next student for navigation
  const allStudents = instance.studentGroup.memberships.map(
    (m: { student: typeof student }) => m.student
  )
  const idx = allStudents.findIndex((s: { id: string }) => s.id === params.studentId)
  const prev = idx > 0 ? allStudents[idx - 1] : null
  const next = idx < allStudents.length - 1 ? allStudents[idx + 1] : null

  return (
    <div className="flex flex-col min-h-screen">
      {/* Topbar */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
        <Link
          href="/(teacher)/grade"
          className="text-slate-500 hover:text-slate-800 text-sm flex items-center gap-1"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to list
        </Link>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-slate-900">
            {student.firstName} {student.lastName}
          </span>
          <span className="text-slate-400 text-sm ml-2">
            {activeInstance.teacherClassAssignment.activityTemplate.displayName}
          </span>
        </div>
        <div className="flex gap-2">
          {prev && (
            <Link
              href={`/(teacher)/grade/${prev.id}`}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Prev
            </Link>
          )}
          {next && (
            <Link
              href={`/(teacher)/grade/${next.id}`}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-1"
            >
              Next
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}
        </div>
      </div>

      {/* Full grading view */}
      <div className="flex-1 p-6">
        <IndividualGradeView
          student={{
            id: student.id,
            firstName: student.firstName,
            lastName: student.lastName,
            currentGrade: null,
            standard1Score: assessment?.standard1Score ? Number(assessment.standard1Score) : null,
            standard2Score: assessment?.standard2Score ? Number(assessment.standard2Score) : null,
            standard3Score: assessment?.standard3Score ? Number(assessment.standard3Score) : null,
            standard4Score: assessment?.standard4Score ? Number(assessment.standard4Score) : null,
            standard4SelfRating: assessment?.standard4SelfRating ? Number(assessment.standard4SelfRating) : null,
            daysLateUnprepared: assessment?.daysLateUnprepared ?? 0,
            effortTeacherScore: assessment?.effortTeacherScore ? Number(assessment.effortTeacherScore) : null,
            responsiblePrepared: assessment?.responsiblePrepared ? Number(assessment.responsiblePrepared) : null,
            respectfulWorks: assessment?.respectfulWorks ? Number(assessment.respectfulWorks) : null,
            lastSaved: assessment?.updatedAt ?? null,
          }}
          activityName={activeInstance.teacherClassAssignment.activityTemplate.name}
          instanceId={activeInstance.id}
          initialSkillScores={skillMap}
        />
      </div>
    </div>
  )
}
