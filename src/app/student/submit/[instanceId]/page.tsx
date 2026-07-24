import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { SubmissionForm } from '@/components/student/SubmissionForm'
import { notFound } from 'next/navigation'
import { Role, RotationStatus } from '@prisma/client'
import { getStudentStandardItemDistribution } from '@/lib/analytics/score-distribution'
import { hasOpenStudentRegradeGrant } from '@/lib/authorization'

export const metadata: Metadata = { title: 'Submit Work' }

export default async function SubmitPage({ params }: { params: Promise<{ instanceId: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== Role.STUDENT) return notFound()

  const { instanceId } = await params

  const student = await db.studentProfile.findUnique({ where: { userId: session.user.id } })
  if (!student) return <div className="p-6 text-gray-500">Student profile not found.</div>

  const instance = await db.historicalClassInstance.findUnique({
    where: { id: instanceId },
    include: {
      teacherClassAssignment: { include: { activityTemplate: true } },
    },
  })
  if (!instance) return notFound()

  // Verify student is in this class instance's group
  const membership = await db.studentGroupMembership.findUnique({
    where: {
      studentGroupId_studentProfileId: {
        studentGroupId: instance.studentGroupId,
        studentProfileId: student.id,
      },
    },
  })
  if (!membership || membership.leftAt) {
    return <div className="p-6 text-red-500">You are not in this class.</div>
  }

  const isOpen =
    instance.status === RotationStatus.ACTIVE || (await hasOpenStudentRegradeGrant(student.id, instanceId))
  if (!isOpen) {
    return (
      <div className="p-6">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500">
          This class is no longer active. Submissions are closed.
        </div>
      </div>
    )
  }

  const activityName = instance.teacherClassAssignment.activityTemplate.name
  const activityTemplateId = instance.teacherClassAssignment.activityTemplateId

  const skillDefinitions = await db.skillDefinition.findMany({
    where: {
      rubricVersion: { activityTemplateId, standardNumber: 1, isActive: true },
      isActive: true,
    },
    select: { id: true, skillName: true, skillType: true, displayOrder: true },
    orderBy: { displayOrder: 'asc' },
  })

  const rubricVersions = await db.rubricVersion.findMany({
    where: {
      activityTemplateId,
      standardNumber: { in: [2, 3, 4] },
      isActive: true,
    },
    include: {
      promptDefinitions: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } },
    },
  })

  const questionsByStandard: Record<number, { id: string; promptText: string; displayOrder: number }[]> = {
    2: [],
    3: [],
    4: [],
  }
  for (const rv of rubricVersions) {
    questionsByStandard[rv.standardNumber] = rv.promptDefinitions.map((p) => ({
      id: p.id,
      promptText: p.promptText,
      displayOrder: p.displayOrder,
    }))
  }

  const existingSubmissions = await db.studentSubmission.findMany({
    where: { studentProfileId: student.id, historicalClassInstanceId: instanceId },
    select: {
      standardNumber: true,
      honorCodeAcknowledgedAt: true,
      status: true,
      latestAttemptNumber: true,
      writtenResponses: true,
      studentSkillSelfRatings: true,
      studentPromptRatings: true,
      studentStandard4Ratings: true,
    },
  })

  // Prefill the form with whatever the student has already entered so they
  // can see (and revise) their prior answers — required for resubmission,
  // where they need a real baseline to meaningfully change.
  const skillRatings: Record<string, number> = {}
  const responses: Record<number, Record<number, string>> = { 2: {}, 3: {}, 4: {} }
  const promptRatings: Record<number, Record<number, number>> = { 2: {}, 3: {} }
  let standard4SelfRating: number | null = null

  const promptDisplayOrderById: Record<string, number> = {}
  for (const std of [2, 3, 4] as const) {
    for (const q of questionsByStandard[std]) promptDisplayOrderById[q.id] = q.displayOrder
  }

  for (const sub of existingSubmissions) {
    if (sub.standardNumber === 1) {
      for (const sr of sub.studentSkillSelfRatings) skillRatings[sr.skillDefinitionId] = sr.rating
    } else if (sub.standardNumber === 2 || sub.standardNumber === 3 || sub.standardNumber === 4) {
      const std = sub.standardNumber
      for (const wr of sub.writtenResponses) {
        const order = promptDisplayOrderById[wr.promptDefinitionId]
        if (order !== undefined) responses[std][order] = wr.responseText
      }
      if (std === 2 || std === 3) {
        for (const pr of sub.studentPromptRatings) {
          const order = promptDisplayOrderById[pr.promptDefinitionId]
          if (order !== undefined) promptRatings[std][order] = pr.rating
        }
      }
      if (std === 4 && sub.studentStandard4Ratings[0]) {
        standard4SelfRating = sub.studentStandard4Ratings[0].rating
      }
    }
  }

  // Analytics shown on the post-submit screen: this class's own standard
  // scores, plus the cross-class distribution (which already covers "all
  // previous classes" — each slice's hover breaks out per-class counts).
  const currentSnapshot = await db.gradeCalculationSnapshot.findFirst({
    where: { studentProfileId: student.id, historicalClassInstanceId: instanceId },
    orderBy: { calculatedAt: 'desc' },
  })
  const scoreDistribution = await getStudentStandardItemDistribution(student.id)

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Submit Work: {activityName}</h1>
      <SubmissionForm
        instanceId={instanceId}
        activityName={activityName}
        skillDefinitions={skillDefinitions}
        standard2Questions={questionsByStandard[2]}
        standard3Questions={questionsByStandard[3]}
        standard4Questions={questionsByStandard[4]}
        existingSubmissions={existingSubmissions.map((s) => ({
          standardNumber: s.standardNumber,
          honorCodeAcknowledged: s.honorCodeAcknowledgedAt != null,
          status: s.status,
          attemptNumber: s.latestAttemptNumber,
        }))}
        initialData={{ skillRatings, responses, promptRatings, standard4SelfRating }}
        currentClassScores={{
          standard1: currentSnapshot?.standard1Score ? Number(currentSnapshot.standard1Score) : null,
          standard2: currentSnapshot?.standard2Score ? Number(currentSnapshot.standard2Score) : null,
          standard3: currentSnapshot?.standard3Score ? Number(currentSnapshot.standard3Score) : null,
          standard4: currentSnapshot?.standard4Score ? Number(currentSnapshot.standard4Score) : null,
          letterGrade: currentSnapshot?.letterGrade ?? null,
        }}
        scoreDistribution={scoreDistribution}
      />
    </div>
  )
}
