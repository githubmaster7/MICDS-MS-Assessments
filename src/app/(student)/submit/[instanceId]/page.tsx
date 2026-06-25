import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { SubmissionForm } from '@/components/student/SubmissionForm'
import { STANDARD2_QUESTIONS } from '@/lib/skills/standard2-questions'
import { STANDARD3_QUESTIONS } from '@/lib/skills/standard3-questions'
import { STANDARD4_QUESTIONS } from '@/lib/skills/standard4-questions'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Submit Work — MICDS PE' }

interface Props {
  params: Promise<{ instanceId: string }>
}

export default async function SubmitInstancePage({ params }: Props) {
  const { instanceId } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'STUDENT') redirect('/unauthorized')

  const student = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, firstName: true },
  })
  if (!student) redirect('/unauthorized')

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
        select: { status: true, studentGroupId: true },
      },
    },
  })
  if (!instance) return notFound()

  // Verify student belongs to this group
  const membership = await db.studentGroupMembership.findFirst({
    where: {
      studentProfileId: student.id,
      studentGroupId: instance.groupRotationAssignment.studentGroupId,
    },
  })
  if (!membership) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="rounded-2xl bg-red-50 border border-red-200 p-8 text-center">
          <p className="font-semibold text-red-700">Access Denied</p>
          <p className="text-sm text-red-600 mt-1">You are not enrolled in this class.</p>
        </div>
      </div>
    )
  }

  if (instance.status === 'LOCKED') {
    return (
      <div className="p-4 sm:p-6 max-w-xl mx-auto">
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-8 text-center">
          <p className="text-3xl mb-3" aria-hidden="true">🔒</p>
          <p className="font-semibold text-slate-700">Submissions Closed</p>
          <p className="text-sm text-slate-500 mt-1">
            This class is locked and no longer accepting submissions.
          </p>
          <Link href="/student/submit" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            Back to Submit Work
          </Link>
        </div>
      </div>
    )
  }

  const activityName = instance.teacherClassAssignment.activityTemplate.name
  const teacher = instance.teacherClassAssignment.teacherProfile
  const teacherName = `${teacher.firstName} ${teacher.lastName}`

  const existingSubmissions = await db.studentSubmission.findMany({
    where: {
      studentProfileId: student.id,
      historicalClassInstanceId: instanceId,
    },
    select: {
      standardNumber: true,
      status: true,
      honorCodeAcknowledgedAt: true,
    },
  })

  // Reassessment not modeled yet — default false
  const reassessmentAllowed = false

  const s2Questions = STANDARD2_QUESTIONS[activityName] ?? []
  const s3Questions = STANDARD3_QUESTIONS[activityName] ?? []
  const s4Questions = STANDARD4_QUESTIONS[activityName] ?? []

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      {/* Back nav */}
      <Link
        href="/student/submit"
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">{activityName}</h1>
        <p className="text-slate-500 text-sm mt-0.5">with {teacherName} · Written Responses</p>
      </div>

      {/* Standards info */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
        <strong>What you're submitting:</strong> Written responses for Standards 2, 3, and 4, plus a self-assessment for Standard 4. Standard 1 (Movement Skills) is assessed by your teacher through observation.
      </div>

      <SubmissionForm
        instanceId={instanceId}
        activityName={activityName}
        standard2Questions={s2Questions}
        standard3Questions={s3Questions}
        standard4Questions={s4Questions}
        existingSubmissions={existingSubmissions.map((s) => ({
          standardNumber: s.standardNumber,
          honorCodeAcknowledged: !!s.honorCodeAcknowledgedAt,
        }))}
        reassessmentAllowed={reassessmentAllowed}
      />
    </div>
  )
}
