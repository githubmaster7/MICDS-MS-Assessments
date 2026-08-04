import { db } from '@/lib/db'

export interface ParentClassDetail {
  activityName: string
  teacher: { firstName: string; lastName: string }
  rotation: { rotationNumber: number; startDate: Date; endDate: Date }
  instanceStatus: string
  snapshot: {
    standard1Score: unknown
    standard2Score: unknown
    standard3Score: unknown
    standard4Score: unknown
    atlScore: unknown
    overallAverage: unknown
    letterGrade: string | null
  } | null
  standard1: {
    skills: { id: string; skillName: string; displayOrder: number; selfRating: number | null }[]
    teacherScore: unknown
    teacherFeedback: string | null
    feedbackVisible: boolean
  }
  standard2: WrittenStandard
  standard3: WrittenStandard
  standard4: {
    prompts: { id: string; promptText: string; displayOrder: number; response: string | null }[]
    selfRating: number | null
    teacherScore: unknown
    teacherFeedback: string | null
    feedbackVisible: boolean
  }
}

interface WrittenStandard {
  prompts: { id: string; promptText: string; displayOrder: number; response: string | null; selfRating: number | null }[]
  teacherScore: unknown
  teacherFeedback: string | null
  feedbackVisible: boolean
}

/**
 * Read-only join of one student's answers/self-ratings for one class instance
 * against the matching teacher score/feedback (feedback only when the
 * teacher has marked it visible) — the parent-facing counterpart to what the
 * student sees on the submit form, but reusable by both the API route and
 * the parent server-component page.
 */
export async function getParentClassDetail(
  studentId: string,
  instanceId: string,
): Promise<ParentClassDetail | null> {
  const studentGroups = await db.studentGroupMembership.findMany({
    where: { studentProfileId: studentId },
    select: { studentGroupId: true },
  })
  const studentGroupIds = studentGroups.map((m) => m.studentGroupId)

  const instance = await db.historicalClassInstance.findUnique({
    where: { id: instanceId },
    include: {
      teacherClassAssignment: {
        include: {
          activityTemplate: { select: { id: true, name: true } },
          teacherProfile: { select: { firstName: true, lastName: true } },
        },
      },
      groupRotationAssignment: {
        select: { rotationNumber: true, startDate: true, endDate: true },
      },
    },
  })
  if (!instance || !studentGroupIds.includes(instance.studentGroupId)) return null

  const activityTemplateId = instance.teacherClassAssignment.activityTemplateId

  const [snapshot, skillDefinitions, rubricVersions, submissions, assessments] = await Promise.all([
    db.gradeCalculationSnapshot.findFirst({
      where: { studentProfileId: studentId, historicalClassInstanceId: instanceId },
      orderBy: { calculatedAt: 'desc' },
    }),
    db.skillDefinition.findMany({
      where: { rubricVersion: { activityTemplateId, standardNumber: 1, isActive: true }, isActive: true },
      select: { id: true, skillName: true, displayOrder: true },
      orderBy: { displayOrder: 'asc' },
    }),
    db.rubricVersion.findMany({
      where: { activityTemplateId, standardNumber: { in: [2, 3, 4] }, isActive: true },
      include: { promptDefinitions: { where: { isActive: true }, orderBy: { displayOrder: 'asc' } } },
    }),
    db.studentSubmission.findMany({
      where: { studentProfileId: studentId, historicalClassInstanceId: instanceId },
      include: {
        writtenResponses: true,
        studentSkillSelfRatings: true,
        studentPromptRatings: true,
        studentStandard4Ratings: true,
      },
    }),
    db.teacherAssessment.findMany({
      where: { studentProfileId: studentId, historicalClassInstanceId: instanceId, isFeedbackStudentVisible: true },
      select: { standardNumber: true, score: true, feedback: true },
    }),
  ])

  const promptsByStandard: Record<2 | 3 | 4, { id: string; promptText: string; displayOrder: number }[]> = {
    2: [], 3: [], 4: [],
  }
  for (const rv of rubricVersions) {
    if (rv.standardNumber === 2 || rv.standardNumber === 3 || rv.standardNumber === 4) {
      promptsByStandard[rv.standardNumber] = rv.promptDefinitions.map((p) => ({
        id: p.id, promptText: p.promptText, displayOrder: p.displayOrder,
      }))
    }
  }

  const submissionByStandard = new Map(submissions.map((s) => [s.standardNumber, s]))
  const assessmentByStandard = new Map(assessments.map((a) => [a.standardNumber, a]))

  const standard1: ParentClassDetail['standard1'] = (() => {
    const submission = submissionByStandard.get(1)
    const ratingsById = new Map(submission?.studentSkillSelfRatings.map((r) => [r.skillDefinitionId, r.rating]) ?? [])
    const assessment = assessmentByStandard.get(1)
    return {
      skills: skillDefinitions.map((s) => ({
        id: s.id, skillName: s.skillName, displayOrder: s.displayOrder,
        selfRating: ratingsById.get(s.id) ?? null,
      })),
      teacherScore: assessment?.score ?? null,
      teacherFeedback: assessment?.feedback ?? null,
      feedbackVisible: !!assessment,
    }
  })()

  const buildWrittenStandard = (std: 2 | 3): WrittenStandard => {
    const submission = submissionByStandard.get(std)
    const responseById = new Map(submission?.writtenResponses.map((r) => [r.promptDefinitionId, r.responseText]) ?? [])
    const ratingById = new Map(submission?.studentPromptRatings.map((r) => [r.promptDefinitionId, r.rating]) ?? [])
    const assessment = assessmentByStandard.get(std)
    return {
      prompts: promptsByStandard[std].map((p) => ({
        id: p.id, promptText: p.promptText, displayOrder: p.displayOrder,
        response: responseById.get(p.id) ?? null,
        selfRating: ratingById.get(p.id) ?? null,
      })),
      teacherScore: assessment?.score ?? null,
      teacherFeedback: assessment?.feedback ?? null,
      feedbackVisible: !!assessment,
    }
  }

  const standard4: ParentClassDetail['standard4'] = (() => {
    const submission = submissionByStandard.get(4)
    const responseById = new Map(submission?.writtenResponses.map((r) => [r.promptDefinitionId, r.responseText]) ?? [])
    const assessment = assessmentByStandard.get(4)
    return {
      prompts: promptsByStandard[4].map((p) => ({
        id: p.id, promptText: p.promptText, displayOrder: p.displayOrder,
        response: responseById.get(p.id) ?? null,
      })),
      selfRating: submission?.studentStandard4Ratings[0]?.rating ?? null,
      teacherScore: assessment?.score ?? null,
      teacherFeedback: assessment?.feedback ?? null,
      feedbackVisible: !!assessment,
    }
  })()

  return {
    activityName: instance.teacherClassAssignment.activityTemplate.name,
    teacher: instance.teacherClassAssignment.teacherProfile,
    rotation: instance.groupRotationAssignment,
    instanceStatus: instance.status,
    snapshot,
    standard1,
    standard2: buildWrittenStandard(2),
    standard3: buildWrittenStandard(3),
    standard4,
  }
}
