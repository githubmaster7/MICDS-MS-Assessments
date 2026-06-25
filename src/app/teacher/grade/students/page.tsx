import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { GradingInterface } from '@/components/grading/GradingInterface'

export const metadata: Metadata = { title: 'Grade Students' }

export default async function GradeStudentsPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const teacher = await db.teacherProfile.findUnique({ where: { userId: session.user.id } })
  if (!teacher) return <div className="p-6 text-gray-500">Teacher profile not found.</div>

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
                    where: { historicalClassInstanceId: undefined },
                    orderBy: { calculatedAt: 'desc' },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
      teacherClassAssignment: { include: { activityTemplate: true } },
    },
  })

  if (!activeInstance) {
    return (
      <div className="p-6">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          No active class assignment found. You can only grade your currently assigned group.
        </div>
      </div>
    )
  }

  const students = activeInstance.studentGroup.memberships.map((m: { student: { id: string; firstName: string; lastName: string; gradeSnapshots: { letterGrade: string | null; standard1Score: unknown; standard2Score: unknown; standard3Score: unknown; standard4Score: unknown }[] } }) => ({
    id: m.student.id,
    firstName: m.student.firstName,
    lastName: m.student.lastName,
    currentGrade: m.student.gradeSnapshots[0]?.letterGrade ?? null,
    standard1Score: m.student.gradeSnapshots[0]?.standard1Score ? Number(m.student.gradeSnapshots[0].standard1Score) : null,
    standard2Score: m.student.gradeSnapshots[0]?.standard2Score ? Number(m.student.gradeSnapshots[0].standard2Score) : null,
    standard3Score: m.student.gradeSnapshots[0]?.standard3Score ? Number(m.student.gradeSnapshots[0].standard3Score) : null,
    standard4Score: m.student.gradeSnapshots[0]?.standard4Score ? Number(m.student.gradeSnapshots[0].standard4Score) : null,
  }))

  return (
    <div className="p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Grade Students</h1>
        <p className="text-gray-500 text-sm mt-1">
          {activeInstance.teacherClassAssignment.activityTemplate.name} · {activeInstance.studentGroup.name}
        </p>
      </div>
      <GradingInterface
        students={students}
        activityName={activeInstance.teacherClassAssignment.activityTemplate.name}
        instanceId={activeInstance.id}
        teacherId={teacher.id}
      />
    </div>
  )
}
