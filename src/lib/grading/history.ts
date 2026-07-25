import { db } from '@/lib/db'

export interface GradeHistoryEntry {
  id: string
  createdAt: Date
  actorEmail: string | null
  beforeValue: unknown
  afterValue: unknown
}

export interface StudentHistoryAttempt {
  attemptNumber: number
  submittedAt: string
  writtenResponses: { promptDefinitionId: string; responseText: string }[]
  skillSelfRatings: { skillDefinitionId: string; rating: number }[]
  promptSelfRatings: { promptDefinitionId: string; rating: number }[]
  standard4SelfRating: number | null
}

export interface GradeAndSubmissionHistory {
  assessments: Awaited<ReturnType<typeof fetchAssessments>>
  snapshot: Awaited<ReturnType<typeof fetchSnapshot>>
  gradeHistory: Record<1 | 2 | 3 | 4, GradeHistoryEntry[]>
  studentHistory: Record<1 | 2 | 3 | 4, StudentHistoryAttempt[]>
  submissionStatus: Record<1 | 2 | 3 | 4, string | null>
  attemptCount: Record<1 | 2 | 3 | 4, number>
}

function fetchAssessments(studentProfileId: string, instanceId: string) {
  return db.teacherAssessment.findMany({
    where: {
      historicalClassInstanceId: instanceId,
      studentProfileId,
    },
    include: {
      teacherSkillScores: {
        include: {
          skillDefinition: { select: { id: true, skillName: true, skillType: true, displayOrder: true } },
        },
      },
      teacherPromptScores: {
        include: {
          promptDefinition: { select: { id: true, promptText: true, standardNumber: true, displayOrder: true } },
        },
      },
      teacherStandard4Ratings: true,
    },
  })
}

function fetchSnapshot(studentProfileId: string, instanceId: string) {
  return db.gradeCalculationSnapshot.findFirst({
    where: { studentProfileId, historicalClassInstanceId: instanceId },
    orderBy: { calculatedAt: 'desc' },
  })
}

/**
 * Single source of truth for a student's resubmission timeline (their own
 * attempts, per standard) and a teacher's grading timeline (score/feedback
 * before → after, per standard, sourced from the audit log). Used by both
 * the teacher-facing grades route and the student-facing history route so
 * the two roles never see divergent data for the same underlying records.
 */
export async function getGradeAndSubmissionHistory(
  studentProfileId: string,
  instanceId: string,
): Promise<GradeAndSubmissionHistory> {
  const [assessments, snapshot, gradeHistoryLogs, submissions] = await Promise.all([
    fetchAssessments(studentProfileId, instanceId),
    fetchSnapshot(studentProfileId, instanceId),
    db.auditLog.findMany({
      where: {
        targetType: 'TeacherAssessment',
        targetId: studentProfileId,
        targetLabel: {
          in: [1, 2, 3, 4].map((n) => `Standard ${n} — student ${studentProfileId} — instance ${instanceId}`),
        },
      },
      include: { actor: { select: { email: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    db.studentSubmission.findMany({
      where: { historicalClassInstanceId: instanceId, studentProfileId },
      include: {
        historyEntries: { orderBy: { attemptNumber: 'asc' } },
        writtenResponses: true,
        studentSkillSelfRatings: true,
        studentPromptRatings: true,
        studentStandard4Ratings: true,
      },
    }),
  ])

  const gradeHistory: Record<1 | 2 | 3 | 4, GradeHistoryEntry[]> = { 1: [], 2: [], 3: [], 4: [] }
  for (const log of gradeHistoryLogs) {
    const match = log.targetLabel?.match(/^Standard (\d) —/)
    const std = match ? (Number(match[1]) as 1 | 2 | 3 | 4) : null
    if (std) {
      gradeHistory[std].push({
        id: log.id,
        createdAt: log.createdAt,
        actorEmail: log.actor?.email ?? null,
        beforeValue: log.beforeValue,
        afterValue: log.afterValue,
      })
    }
  }

  const submissionStatus: Record<1 | 2 | 3 | 4, string | null> = { 1: null, 2: null, 3: null, 4: null }
  const attemptCount: Record<1 | 2 | 3 | 4, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const studentHistory: Record<1 | 2 | 3 | 4, StudentHistoryAttempt[]> = { 1: [], 2: [], 3: [], 4: [] }

  for (const sub of submissions) {
    const std = sub.standardNumber as 1 | 2 | 3 | 4
    if (std !== 1 && std !== 2 && std !== 3 && std !== 4) continue
    submissionStatus[std] = sub.status
    attemptCount[std] = sub.latestAttemptNumber
    studentHistory[std] = sub.historyEntries.map((h) => {
      const s = h.snapshotData as {
        writtenResponses?: { promptDefinitionId: string; responseText: string }[]
        skillSelfRatings?: { skillDefinitionId: string; rating: number }[]
        promptSelfRatings?: { promptDefinitionId: string; rating: number }[]
        standard4SelfRating?: number | null
      }
      return {
        attemptNumber: h.attemptNumber,
        submittedAt: h.submittedAt.toISOString(),
        writtenResponses: s.writtenResponses ?? [],
        skillSelfRatings: s.skillSelfRatings ?? [],
        promptSelfRatings: s.promptSelfRatings ?? [],
        standard4SelfRating: s.standard4SelfRating ?? null,
      }
    })

    // The live/current attempt isn't frozen into a SubmissionHistoryEntry
    // until the *next* resubmission — append it as the timeline's final
    // entry so the modal shows every attempt, not just the frozen ones.
    if (sub.status !== 'NOT_STARTED') {
      studentHistory[std].push({
        attemptNumber: sub.latestAttemptNumber,
        submittedAt: (sub.reassessmentSubmittedAt ?? sub.submittedAt ?? sub.updatedAt).toISOString(),
        writtenResponses: sub.writtenResponses.map((wr) => ({
          promptDefinitionId: wr.promptDefinitionId,
          responseText: wr.responseText,
        })),
        skillSelfRatings: sub.studentSkillSelfRatings.map((sr) => ({
          skillDefinitionId: sr.skillDefinitionId,
          rating: sr.rating,
        })),
        promptSelfRatings: sub.studentPromptRatings.map((pr) => ({
          promptDefinitionId: pr.promptDefinitionId,
          rating: pr.rating,
        })),
        standard4SelfRating: sub.studentStandard4Ratings[0]?.rating ?? null,
      })
    }
  }

  return { assessments, snapshot, gradeHistory, studentHistory, submissionStatus, attemptCount }
}
