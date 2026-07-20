import { db } from '@/lib/db'

/**
 * Per-standard distribution of individual teacher-rated items for one
 * student, pooled across every class (rotation) they've been graded in.
 *
 * This is deliberately NOT the rolled-up Standard 1–4 score per class —
 * it's every individual item that feeds into that rollup:
 *   - Standard 1: each TeacherSkillScore
 *   - Standard 2 / 3: each TeacherPromptScore for that standard's questions
 *   - Standard 4: each TeacherPromptScore for its question, plus the
 *     teacher's own TeacherStandard4Rating (student self-ratings are
 *     excluded — these are the teacher's ratings only)
 *
 * Example: if Class A had three 4s and one 3 in Standard 1, and Class B had
 * two 3s and two 4s, the Standard 1 bucket set is five 4s and three 3s
 * pooled across both classes — each bucket also records which class each
 * count came from, for a hover breakdown.
 */

export interface ClassScoreCount {
  instanceId: string
  className: string
  count: number
}

export interface ScoreBucket {
  score: number
  total: number
  byClass: ClassScoreCount[]
}

const ITEM_SCORE_VALUES = [4, 3, 2, 1] as const

function emptyBucketMaps(): Map<number, Map<string, ClassScoreCount>> {
  const m = new Map<number, Map<string, ClassScoreCount>>()
  for (const score of ITEM_SCORE_VALUES) m.set(score, new Map())
  return m
}

function addCount(
  bucketMaps: Map<number, Map<string, ClassScoreCount>>,
  score: number,
  instanceId: string,
  className: string,
) {
  const byClass = bucketMaps.get(score)
  if (!byClass) return // defensive: ignore any out-of-range value
  const existing = byClass.get(instanceId)
  if (existing) existing.count += 1
  else byClass.set(instanceId, { instanceId, className, count: 1 })
}

function toBuckets(bucketMaps: Map<number, Map<string, ClassScoreCount>>): ScoreBucket[] {
  return ITEM_SCORE_VALUES.map((score) => {
    const byClass = [...(bucketMaps.get(score)?.values() ?? [])].sort((a, b) => b.count - a.count)
    return { score, total: byClass.reduce((sum, c) => sum + c.count, 0), byClass }
  }).filter((b) => b.total > 0)
}

export async function getStudentStandardItemDistribution(
  studentProfileId: string,
): Promise<Record<1 | 2 | 3 | 4, ScoreBucket[]>> {
  const assessments = await db.teacherAssessment.findMany({
    where: { studentProfileId },
    select: {
      standardNumber: true,
      historicalClassInstanceId: true,
      teacherSkillScores: { select: { score: true } },
      teacherPromptScores: { select: { score: true } },
      teacherStandard4Ratings: { select: { rating: true } },
      historicalClassInstance: {
        select: { teacherClassAssignment: { select: { activityTemplate: { select: { name: true } } } } },
      },
    },
  })

  const perStandard: Record<1 | 2 | 3 | 4, Map<number, Map<string, ClassScoreCount>>> = {
    1: emptyBucketMaps(),
    2: emptyBucketMaps(),
    3: emptyBucketMaps(),
    4: emptyBucketMaps(),
  }

  for (const a of assessments) {
    const std = a.standardNumber as 1 | 2 | 3 | 4
    if (std !== 1 && std !== 2 && std !== 3 && std !== 4) continue
    const className = a.historicalClassInstance.teacherClassAssignment.activityTemplate.name
    const instanceId = a.historicalClassInstanceId

    if (std === 1) {
      for (const s of a.teacherSkillScores) addCount(perStandard[1], s.score, instanceId, className)
    } else {
      for (const p of a.teacherPromptScores) addCount(perStandard[std], p.score, instanceId, className)
      if (std === 4) {
        for (const r of a.teacherStandard4Ratings) addCount(perStandard[4], r.rating, instanceId, className)
      }
    }
  }

  return {
    1: toBuckets(perStandard[1]),
    2: toBuckets(perStandard[2]),
    3: toBuckets(perStandard[3]),
    4: toBuckets(perStandard[4]),
  }
}

const ATL_CATEGORIES = ['responsiblePrepared', 'respectfulWorks', 'effortTeacherScore'] as const
export type ATLCategory = (typeof ATL_CATEGORIES)[number]

/**
 * Approach to Learning distribution for one student, pooled across all their
 * classes — the same shape/logic as getStudentStandardItemDistribution
 * above, but for the 3 ATL categories (teacher-only ratings; there is no
 * student self-rating for ATL, unlike the 4 PE standards).
 */
export async function getStudentApproachToLearningDistribution(
  studentProfileId: string,
): Promise<Record<ATLCategory, ScoreBucket[]>> {
  const records = await db.approachToLearningRecord.findMany({
    where: { studentProfileId },
    select: {
      historicalClassInstanceId: true,
      responsiblePrepared: true,
      respectfulWorks: true,
      effortTeacherScore: true,
      historicalClassInstance: {
        select: { teacherClassAssignment: { select: { activityTemplate: { select: { name: true } } } } },
      },
    },
  })

  const perCategory: Record<ATLCategory, Map<number, Map<string, ClassScoreCount>>> = {
    responsiblePrepared: emptyBucketMaps(),
    respectfulWorks: emptyBucketMaps(),
    effortTeacherScore: emptyBucketMaps(),
  }

  for (const r of records) {
    const className = r.historicalClassInstance.teacherClassAssignment.activityTemplate.name
    for (const category of ATL_CATEGORIES) {
      const value = r[category]
      if (value === null || value === undefined) continue
      addCount(perCategory[category], Math.round(Number(value)), r.historicalClassInstanceId, className)
    }
  }

  return {
    responsiblePrepared: toBuckets(perCategory.responsiblePrepared),
    respectfulWorks: toBuckets(perCategory.respectfulWorks),
    effortTeacherScore: toBuckets(perCategory.effortTeacherScore),
  }
}
