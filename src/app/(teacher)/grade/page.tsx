import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { GradingWorkspace } from './GradingWorkspace'

export const metadata: Metadata = { title: 'Grade Students' }

export default async function GradePage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const teacher = await db.teacherProfile.findUnique({ where: { userId: session.user.id } })
  if (!teacher) {
    return (
      <div className="p-8 text-slate-500">Teacher profile not found.</div>
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
          memberships: {
            where: { leftAt: null },
            include: {
              student: {
                include: {
                  gradeSnapshots: {
                    orderBy: { calculatedAt: 'desc' },
                    take: 1,
                  },
                  teacherAssessments: {
                    orderBy: { updatedAt: 'desc' },
                    take: 1,
                    select: {
                      id: true,
                      standard1Score: true,
                      standard2Score: true,
                      standard3Score: true,
                      standard4Score: true,
                      standard4SelfRating: true,
                      daysLateUnprepared: true,
                      effortTeacherScore: true,
                      responsiblePrepared: true,
                      respectfulWorks: true,
                      updatedAt: true,
                    },
                  },
                },
              },
            },
            orderBy: { student: { lastName: 'asc' } },
          },
        },
      },
      teacherClassAssignment: {
        include: { activityTemplate: true },
      },
      groupRotationAssignment: true,
    },
  })

  if (!activeInstance) {
    return (
      <div className="p-8">
        <div className="max-w-lg mx-auto bg-white border border-slate-200 rounded-xl p-8 text-center">
          <div className="text-3xl mb-4">📋</div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">No Active Assignment</h2>
          <p className="text-slate-500 text-sm">
            You don't have an active class assignment. You can only grade your currently assigned group.
          </p>
        </div>
      </div>
    )
  }

  const students = activeInstance.studentGroup.memberships.map((m: (typeof activeInstance.studentGroup.memberships)[number]) => {
    const snap = m.student.gradeSnapshots[0]
    const assessment = m.student.teacherAssessments[0]
    return {
      id: m.student.id,
      firstName: m.student.firstName,
      lastName: m.student.lastName,
      currentGrade: snap?.letterGrade ?? null,
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
    }
  })

  return (
    <div className="flex flex-col h-screen">
      {/* Page header */}
      <div className="shrink-0 px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900 leading-tight">Grade Students</h1>
          <p className="text-sm text-slate-500">
            {activeInstance.teacherClassAssignment.activityTemplate.displayName}
            {' · '}
            {activeInstance.studentGroup.name}
            {' · '}
            <span className="text-slate-400">{students.filter((s: { currentGrade: string | null }) => s.currentGrade).length}/{students.length} graded</span>
          </p>
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex-1 min-h-0">
        <GradingWorkspace
          students={students}
          activityName={activeInstance.teacherClassAssignment.activityTemplate.name}
          instanceId={activeInstance.id}
        />
      </div>
    </div>
  )
}
