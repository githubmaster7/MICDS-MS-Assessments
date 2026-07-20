import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import { Role, RotationStatus } from '@prisma/client'
import Link from 'next/link'
import { hasOpenStudentRegradeGrant } from '@/lib/authorization'

export const metadata: Metadata = { title: 'Class Detail' }

export default async function StudentClassDetailPage({
  params,
}: {
  params: { instanceId: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== Role.STUDENT) return notFound()

  const { instanceId } = params

  // Get the student profile
  const studentProfile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      groupMemberships: {
        select: { studentGroupId: true },
      },
    },
  })
  if (!studentProfile) return notFound()

  const studentGroupIds = (studentProfile.groupMemberships as { studentGroupId: string }[]).map(
    (m) => m.studentGroupId,
  )

  // Get the class instance and verify this student's group is associated
  const instance = await db.historicalClassInstance.findUnique({
    where: { id: instanceId },
    include: {
      teacherClassAssignment: {
        include: {
          activityTemplate: { select: { name: true } },
          teacherProfile: { select: { firstName: true, lastName: true } },
        },
      },
      groupRotationAssignment: {
        select: { rotationNumber: true, startDate: true, endDate: true },
      },
    },
  })

  if (!instance) return notFound()

  // Verify student was in the group for this instance
  const instanceGroupId = (instance as { studentGroupId: string }).studentGroupId
  if (!studentGroupIds.includes(instanceGroupId)) return notFound()

  // Get grade snapshot (latest)
  const snapshot = await db.gradeCalculationSnapshot.findFirst({
    where: {
      historicalClassInstanceId: instanceId,
      studentProfileId: studentProfile.id,
    },
    orderBy: { calculatedAt: 'desc' },
    select: {
      standard1Score: true,
      standard2Score: true,
      standard3Score: true,
      standard4Score: true,
      atlScore: true,
      overallAverage: true,
      letterGrade: true,
      calculatedAt: true,
    },
  })

  // Get teacher assessments (visible to student)
  const assessments = await db.teacherAssessment.findMany({
    where: {
      historicalClassInstanceId: instanceId,
      studentProfileId: studentProfile.id,
      isFeedbackStudentVisible: true,
    },
    select: {
      standardNumber: true,
      score: true,
      feedback: true,
      assessedAt: true,
    },
    orderBy: { standardNumber: 'asc' },
  })

  const inst = instance as {
    studentGroupId: string
    teacherClassAssignment: {
      activityTemplate: { name: string }
      teacherProfile: { firstName: string; lastName: string }
    }
    groupRotationAssignment: { rotationNumber: number; startDate: Date; endDate: Date }
  }

  const activityName = inst.teacherClassAssignment.activityTemplate.name
  const teacher = inst.teacherClassAssignment.teacherProfile
  const rotation = inst.groupRotationAssignment

  const canSubmit =
    instance.status === RotationStatus.ACTIVE ||
    (await hasOpenStudentRegradeGrant(studentProfile.id, instanceId))

  const gradeColorClass: Record<string, string> = {
    A: 'bg-emerald-600',
    'A-': 'bg-emerald-500',
    'B+': 'bg-blue-600',
    B: 'bg-blue-500',
    'B-': 'bg-blue-400',
    'C+': 'bg-yellow-500',
    C: 'bg-yellow-400',
    'C-': 'bg-orange-500',
    'D+': 'bg-orange-600',
    D: 'bg-red-500',
    'D-': 'bg-red-600',
    F: 'bg-red-700',
  }

  const scoreLabel = (score: number | null) => {
    if (score === null) return '—'
    if (score >= 3.5) return 'Advanced'
    if (score >= 3) return 'Proficient'
    if (score >= 2.5) return 'Developing+'
    if (score >= 2) return 'Developing'
    return 'Beginning'
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{activityName}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Class {rotation.rotationNumber} ·{' '}
          {new Date(rotation.startDate).toLocaleDateString()} –{' '}
          {new Date(rotation.endDate).toLocaleDateString()}
        </p>
        <p className="text-sm text-gray-500">
          Teacher: {teacher.firstName} {teacher.lastName}
        </p>
        {canSubmit && (
          <Link
            href={`/student/submit/${instanceId}`}
            className="inline-block mt-3 bg-blue-700 hover:bg-blue-800 transition-colors text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            Submit Work
          </Link>
        )}
      </div>

      {/* Grade summary */}
      {snapshot ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Grade Summary</h2>
          <div className="flex items-center gap-4 mb-4">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold ${gradeColorClass[snapshot.letterGrade as string] ?? 'bg-gray-400'}`}
            >
              {snapshot.letterGrade ?? '—'}
            </div>
            <div>
              <div className="text-sm text-gray-500">Overall Average</div>
              <div className="text-lg font-semibold text-gray-900">
                {snapshot.overallAverage != null ? Number(snapshot.overallAverage).toFixed(2) : '—'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((std) => {
              const score = snapshot[`standard${std}Score` as keyof typeof snapshot]
              const numScore = score != null ? Number(score) : null
              return (
                <div key={std} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Standard {std}</div>
                  <div className="font-semibold text-gray-900">
                    {numScore != null ? numScore.toFixed(2) : '—'}
                  </div>
                  <div className="text-xs text-gray-400">{scoreLabel(numScore)}</div>
                </div>
              )
            })}
          </div>
          {snapshot.atlScore != null && (
            <div className="mt-3 bg-purple-50 rounded-lg p-3">
              <div className="text-xs text-purple-600 mb-1">ATL Score</div>
              <div className="font-semibold text-gray-900">{Number(snapshot.atlScore).toFixed(2)}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-6 text-center text-gray-400 text-sm">
          No grade calculated yet.
        </div>
      )}

      {/* Teacher feedback */}
      {assessments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Teacher Feedback</h2>
          <div className="space-y-3">
            {(assessments as { standardNumber: number; score: unknown; feedback: string | null; assessedAt: Date }[]).map(
              (a) => (
                <div key={a.standardNumber} className="p-3 bg-blue-50 rounded-lg text-sm">
                  <div className="text-xs text-blue-600 font-medium mb-1">
                    Standard {a.standardNumber}
                    {a.score != null && (
                      <span className="ml-2 text-gray-500">· Score: {Number(a.score).toFixed(2)}</span>
                    )}
                  </div>
                  {a.feedback ? (
                    <p className="text-gray-700">{a.feedback}</p>
                  ) : (
                    <p className="text-gray-400 italic">No written feedback.</p>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  )
}
