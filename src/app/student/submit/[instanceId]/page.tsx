import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { StudentSubmissionForm } from '@/components/student/StudentSubmissionForm'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'Submit Work' }

export default async function SubmitPage({ params }: { params: { instanceId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const student = await db.studentProfile.findUnique({ where: { userId: session.user.id } })
  if (!student) return <div className="p-6 text-gray-500">Student profile not found.</div>

  const instance = await db.historicalClassInstance.findUnique({
    where: { id: params.instanceId },
    include: {
      rotationAssignment: {
        include: { activityTemplate: true, studentGroup: true },
      },
    },
  }).catch(() => null)

  if (!instance) return notFound()

  // Verify student is in this group
  const membership = await db.studentGroupMembership.findFirst({
    where: { studentId: student.id, groupId: instance.rotationAssignment.studentGroupId, leftAt: null },
  })
  if (!membership) return <div className="p-6 text-red-500">You are not in this class.</div>

  if (instance.rotationAssignment.status !== 'ACTIVE') {
    return (
      <div className="p-6">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500">
          This class is no longer active. Submissions are closed.
        </div>
      </div>
    )
  }

  const existingSubmissions = await db.studentSubmission.findMany({
    where: { studentId: student.id, instanceId: params.instanceId },
  })

  const activityName = instance.rotationAssignment.activityTemplate.name

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Submit Work: {instance.rotationAssignment.activityTemplate.name}
      </h1>
      <StudentSubmissionForm
        instanceId={params.instanceId}
        activityName={activityName}
        existingSubmissions={existingSubmissions}
      />
    </div>
  )
}
