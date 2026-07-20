import { Metadata } from 'next'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { GradingInterface, type GradeDataByStudent, type HistoryAttempt, type GradeHistoryEntry } from '@/components/grading/GradingInterface'

export const metadata: Metadata = { title: 'Grade Students' }

function toNum(d: { toNumber: () => number } | null | undefined): number | null {
  return d ? d.toNumber() : null
}

export default async function GradeStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ instanceId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const teacher = await db.teacherProfile.findUnique({ where: { userId: session.user.id } })
  if (!teacher) return <div className="p-6 text-gray-500">Teacher profile not found.</div>

  // A teacher can have more than one simultaneously-ACTIVE class when they
  // teach multiple groups at once (each group rotates independently) — fetch
  // all of them so none are silently hidden from grading. Also include any
  // LOCKED class an admin has reopened for this teacher's regrading, so a
  // regrade grant is actually reachable through the UI, not just the API.
  const availableInstances = await db.historicalClassInstance.findMany({
    where: {
      teacherClassAssignment: { teacherProfileId: teacher.id },
      OR: [
        { status: 'ACTIVE' },
        { status: 'LOCKED', regradeGrants: { some: { teacherRegradeEnabled: true, closedAt: null } } },
      ],
    },
    include: {
      studentGroup: {
        include: {
          memberships: {
            where: { leftAt: null },
            include: {
              studentProfile: {
                include: {
                  gradeSnapshots: {
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
    orderBy: { studentGroup: { name: 'asc' } },
  })

  if (availableInstances.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          No active class assignment found. You can only grade your currently assigned group, or a locked class an admin has reopened for you.
        </div>
      </div>
    )
  }

  const { instanceId } = await searchParams
  const activeInstance = availableInstances.find((i) => i.id === instanceId) ?? availableInstances[0]

  const students = activeInstance.studentGroup.memberships.map((m) => ({
    id: m.studentProfile.id,
    firstName: m.studentProfile.firstName,
    lastName: m.studentProfile.lastName,
    currentGrade: m.studentProfile.gradeSnapshots[0]?.letterGrade ?? null,
  }))
  const studentIds = students.map((s) => s.id)

  const activityTemplateId = activeInstance.teacherClassAssignment.activityTemplateId

  // Standard 1 skill definitions for this activity — fundamental + specific.
  const skillDefinitions = await db.skillDefinition.findMany({
    where: {
      rubricVersion: { activityTemplateId, standardNumber: 1, isActive: true },
      isActive: true,
    },
    select: { id: true, skillName: true, skillType: true, displayOrder: true },
    orderBy: { displayOrder: 'asc' },
  })

  // Standard 2/3/4 concept questions for this activity.
  const rubricVersions234 = await db.rubricVersion.findMany({
    where: { activityTemplateId, standardNumber: { in: [2, 3, 4] }, isActive: true },
    include: {
      promptDefinitions: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } },
    },
  })
  const promptsByStandard: Record<2 | 3 | 4, { id: string; promptText: string; displayOrder: number }[]> = {
    2: [],
    3: [],
    4: [],
  }
  for (const rv of rubricVersions234) {
    if (rv.standardNumber === 2 || rv.standardNumber === 3 || rv.standardNumber === 4) {
      promptsByStandard[rv.standardNumber] = rv.promptDefinitions.map((p) => ({
        id: p.id,
        promptText: p.promptText,
        displayOrder: p.displayOrder,
      }))
    }
  }

  // Existing teacher assessments (scores already entered) for every student.
  const assessments = await db.teacherAssessment.findMany({
    where: { teacherProfileId: teacher.id, historicalClassInstanceId: activeInstance.id, studentProfileId: { in: studentIds } },
    include: { teacherSkillScores: true, teacherPromptScores: true, teacherStandard4Ratings: true },
  })

  // Student submissions (written answers + self-ratings) for every student.
  const submissions = await db.studentSubmission.findMany({
    where: { historicalClassInstanceId: activeInstance.id, studentProfileId: { in: studentIds } },
    include: {
      writtenResponses: true,
      studentSkillSelfRatings: true,
      studentPromptRatings: true,
      studentStandard4Ratings: true,
      historyEntries: { orderBy: { attemptNumber: 'asc' } },
    },
  })

  // Approach to Learning records for every student.
  const atlRecords = await db.approachToLearningRecord.findMany({
    where: { historicalClassInstanceId: activeInstance.id, studentProfileId: { in: studentIds } },
  })

  // Teacher grading history (every save, before/after score + feedback),
  // sourced from the audit log — the teacher-side counterpart to the
  // student's own resubmission history above.
  const gradeHistoryLogs = await db.auditLog.findMany({
    where: {
      targetType: 'TeacherAssessment',
      targetId: { in: studentIds },
      targetLabel: {
        in: studentIds.flatMap((id) =>
          [1, 2, 3, 4].map((n) => `Standard ${n} — student ${id} — instance ${activeInstance.id}`),
        ),
      },
    },
    include: { actor: { select: { email: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const gradeData: GradeDataByStudent = {}
  for (const s of students) {
    const studentAssessments = assessments.filter((a) => a.studentProfileId === s.id)
    const studentSubmissions = submissions.filter((sub) => sub.studentProfileId === s.id)
    const atl = atlRecords.find((a) => a.studentProfileId === s.id) ?? null

    const skillScores: Record<string, 1 | 2 | 3 | 4> = {}
    const promptScores: Record<string, 1 | 2 | 3 | 4> = {}
    let standard4TeacherRating: 1 | 2 | 3 | 4 | null = null
    const standardScores: Record<1 | 2 | 3 | 4, number | null> = { 1: null, 2: null, 3: null, 4: null }
    const feedback: Record<1 | 2 | 3 | 4, string> = { 1: '', 2: '', 3: '', 4: '' }
    const feedbackVisible: Record<1 | 2 | 3 | 4, boolean> = { 1: false, 2: false, 3: false, 4: false }

    for (const a of studentAssessments) {
      const std = a.standardNumber as 1 | 2 | 3 | 4
      standardScores[std] = toNum(a.score)
      feedback[std] = a.feedback ?? ''
      feedbackVisible[std] = a.isFeedbackStudentVisible
      for (const ss of a.teacherSkillScores) skillScores[ss.skillDefinitionId] = ss.score as 1 | 2 | 3 | 4
      for (const ps of a.teacherPromptScores) promptScores[ps.promptDefinitionId] = ps.score as 1 | 2 | 3 | 4
      if (a.teacherStandard4Ratings[0]) standard4TeacherRating = a.teacherStandard4Ratings[0].rating as 1 | 2 | 3 | 4
    }

    const writtenResponses: Record<string, { text: string }> = {}
    const skillSelfRatings: Record<string, 1 | 2 | 3 | 4> = {}
    const promptSelfRatings: Record<string, 1 | 2 | 3 | 4> = {}
    let standard4StudentSelfRating: 1 | 2 | 3 | 4 | null = null
    const submissionStatus: Record<1 | 2 | 3 | 4, string | null> = { 1: null, 2: null, 3: null, 4: null }
    const attemptCount: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
    const history: Record<1 | 2 | 3 | 4, HistoryAttempt[]> = { 1: [], 2: [], 3: [], 4: [] }

    for (const sub of studentSubmissions) {
      const std = sub.standardNumber as 1 | 2 | 3 | 4
      submissionStatus[std] = sub.status
      attemptCount[std] = sub.latestAttemptNumber
      history[std] = sub.historyEntries.map((h) => {
        const snapshot = h.snapshotData as {
          writtenResponses?: { promptDefinitionId: string; responseText: string }[]
          skillSelfRatings?: { skillDefinitionId: string; rating: number }[]
          promptSelfRatings?: { promptDefinitionId: string; rating: number }[]
          standard4SelfRating?: number | null
        }
        return {
          attemptNumber: h.attemptNumber,
          submittedAt: h.submittedAt.toISOString(),
          writtenResponses: snapshot.writtenResponses ?? [],
          skillSelfRatings: snapshot.skillSelfRatings ?? [],
          promptSelfRatings: snapshot.promptSelfRatings ?? [],
          standard4SelfRating: (snapshot.standard4SelfRating as 1 | 2 | 3 | 4 | null | undefined) ?? null,
        }
      })
      for (const wr of sub.writtenResponses) {
        writtenResponses[wr.promptDefinitionId] = { text: wr.responseText }
      }
      for (const sr of sub.studentSkillSelfRatings) {
        skillSelfRatings[sr.skillDefinitionId] = sr.rating as 1 | 2 | 3 | 4
      }
      for (const pr of sub.studentPromptRatings) {
        promptSelfRatings[pr.promptDefinitionId] = pr.rating as 1 | 2 | 3 | 4
      }
      if (sub.studentStandard4Ratings[0]) {
        standard4StudentSelfRating = sub.studentStandard4Ratings[0].rating as 1 | 2 | 3 | 4
      }
    }

    const gradeHistory: Record<1 | 2 | 3 | 4, GradeHistoryEntry[]> = { 1: [], 2: [], 3: [], 4: [] }
    for (const log of gradeHistoryLogs) {
      if (log.targetId !== s.id) continue
      const match = log.targetLabel?.match(/^Standard (\d) —/)
      const std = match ? (Number(match[1]) as 1 | 2 | 3 | 4) : null
      if (!std) continue
      gradeHistory[std].push({
        id: log.id,
        createdAt: log.createdAt.toISOString(),
        actorEmail: log.actor?.email ?? null,
        beforeValue: log.beforeValue as GradeHistoryEntry['beforeValue'],
        afterValue: log.afterValue as GradeHistoryEntry['afterValue'],
      })
    }

    gradeData[s.id] = {
      skillScores,
      promptScores,
      skillSelfRatings,
      promptSelfRatings,
      standard4TeacherRating,
      standard4StudentSelfRating,
      standardScores,
      feedback,
      feedbackVisible,
      writtenResponses,
      submissionStatus,
      attemptCount,
      history,
      gradeHistory,
      atl: {
        responsiblePrepared: (toNum(atl?.responsiblePrepared) as 1 | 2 | 3 | 4 | null) ?? null,
        respectfulWorks: (toNum(atl?.respectfulWorks) as 1 | 2 | 3 | 4 | null) ?? null,
        effortTeacherScore: (toNum(atl?.effortTeacherScore) as 1 | 2 | 3 | 4 | null) ?? null,
        effortStudentScore: (toNum(atl?.effortStudentScore) as 1 | 2 | 3 | 4 | null) ?? null,
        daysLateUnprepared: atl?.daysLateUnprepared ?? 0,
        calculatedScore: toNum(atl?.calculatedScore),
      },
    }
  }

  return (
    <div className="p-6 max-w-7xl">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Grade Students
            {activeInstance.status === 'LOCKED' && (
              <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Reopened by admin</span>
            )}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {activeInstance.teacherClassAssignment.activityTemplate.name} · {activeInstance.studentGroup.name}
          </p>
        </div>
        <Link
          href={`/teacher/class/${activeInstance.id}`}
          className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-blue-300"
        >
          View Class Analytics
        </Link>
      </div>
      {availableInstances.length > 1 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {availableInstances.map((inst) => (
            <Link
              key={inst.id}
              href={`/teacher/grade/students?instanceId=${inst.id}`}
              className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                inst.id === activeInstance.id
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
              }`}
            >
              {inst.teacherClassAssignment.activityTemplate.name} · {inst.studentGroup.name}
              {inst.status === 'LOCKED' && ' 🔓'}
            </Link>
          ))}
        </div>
      )}
      <GradingInterface
        students={students}
        activityName={activeInstance.teacherClassAssignment.activityTemplate.name}
        instanceId={activeInstance.id}
        skillDefinitions={skillDefinitions}
        promptsByStandard={promptsByStandard}
        gradeData={gradeData}
      />
    </div>
  )
}
