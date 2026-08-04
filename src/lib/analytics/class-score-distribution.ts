import { db } from '@/lib/db'

/**
 * Per-standard distribution of individual teacher-rated items for one
 * class instance, pooled across every student in that class.
 *
 * This is the group-view counterpart to getStudentStandardItemDistribution
 * (src/lib/analytics/score-distribution.ts) — same bucket shape, but the
 * breakdown axis is by student instead of by class, since here there's only
 * one class and many students.
 */

export interface StudentScoreCount {
  studentProfileId: string
  studentName: string
  count: number
}

export interface GroupScoreBucket {
  score: number
  total: number
  byStudent: StudentScoreCount[]
}

export interface ATLCategoryBucket {
  score: number
  total: number
  byStudent: StudentScoreCount[]
}

export interface ATLCategorySummary {
  average: number | null
  buckets: ATLCategoryBucket[]
}

const ITEM_SCORE_VALUES = [4, 3, 2, 1] as const

function emptyBucketMaps(): Map<number, Map<string, StudentScoreCount>> {
  const m = new Map<number, Map<string, StudentScoreCount>>()
  for (const score of ITEM_SCORE_VALUES) m.set(score, new Map())
  return m
}

function addCount(
  bucketMaps: Map<number, Map<string, StudentScoreCount>>,
  score: number,
  studentProfileId: string,
  studentName: string,
) {
  const byStudent = bucketMaps.get(Math.round(score))
  if (!byStudent) return // defensive: ignore any out-of-range value
  const existing = byStudent.get(studentProfileId)
  if (existing) existing.count += 1
  else byStudent.set(studentProfileId, { studentProfileId, studentName, count: 1 })
}

function toBuckets(bucketMaps: Map<number, Map<string, StudentScoreCount>>): GroupScoreBucket[] {
  return ITEM_SCORE_VALUES.map((score) => {
    const byStudent = [...(bucketMaps.get(score)?.values() ?? [])].sort((a, b) => b.count - a.count)
    return { score, total: byStudent.reduce((sum, c) => sum + c.count, 0), byStudent }
  }).filter((b) => b.total > 0)
}

export async function getClassStandardItemDistribution(
  historicalClassInstanceId: string,
): Promise<Record<1 | 2 | 3 | 4, GroupScoreBucket[]>> {
  const assessments = await db.teacherAssessment.findMany({
    where: { historicalClassInstanceId },
    select: {
      standardNumber: true,
      studentProfileId: true,
      studentProfile: { select: { firstName: true, lastName: true } },
      teacherSkillScores: { select: { score: true } },
      teacherPromptScores: { select: { score: true } },
      teacherStandard4Ratings: { select: { rating: true } },
    },
  })

  const perStandard: Record<1 | 2 | 3 | 4, Map<number, Map<string, StudentScoreCount>>> = {
    1: emptyBucketMaps(),
    2: emptyBucketMaps(),
    3: emptyBucketMaps(),
    4: emptyBucketMaps(),
  }

  for (const a of assessments) {
    const std = a.standardNumber as 1 | 2 | 3 | 4
    if (std !== 1 && std !== 2 && std !== 3 && std !== 4) continue
    const studentName = `${a.studentProfile.firstName} ${a.studentProfile.lastName}`

    if (std === 1) {
      for (const s of a.teacherSkillScores) addCount(perStandard[1], s.score, a.studentProfileId, studentName)
    } else {
      for (const p of a.teacherPromptScores) addCount(perStandard[std], p.score, a.studentProfileId, studentName)
      if (std === 4) {
        for (const r of a.teacherStandard4Ratings) addCount(perStandard[4], r.rating, a.studentProfileId, studentName)
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
 * Class-wide Approach to Learning summary — one bucket set per category
 * (Responsible & Prepared, Respectful & Works Well, Effort), each with a
 * class average and a byStudent hover breakdown, mirroring the standard
 * item-distribution shape above.
 */
export async function getClassApproachToLearningSummary(
  historicalClassInstanceId: string,
): Promise<Record<ATLCategory, ATLCategorySummary>> {
  const records = await db.approachToLearningRecord.findMany({
    where: { historicalClassInstanceId },
    select: {
      studentProfileId: true,
      studentProfile: { select: { firstName: true, lastName: true } },
      responsiblePrepared: true,
      respectfulWorks: true,
      effortTeacherScore: true,
    },
  })

  const perCategory: Record<ATLCategory, Map<number, Map<string, StudentScoreCount>>> = {
    responsiblePrepared: emptyBucketMaps(),
    respectfulWorks: emptyBucketMaps(),
    effortTeacherScore: emptyBucketMaps(),
  }
  const sums: Record<ATLCategory, { total: number; count: number }> = {
    responsiblePrepared: { total: 0, count: 0 },
    respectfulWorks: { total: 0, count: 0 },
    effortTeacherScore: { total: 0, count: 0 },
  }

  for (const r of records) {
    const studentName = `${r.studentProfile.firstName} ${r.studentProfile.lastName}`
    for (const category of ATL_CATEGORIES) {
      const value = r[category]
      if (value === null || value === undefined) continue
      const score = Number(value)
      addCount(perCategory[category], score, r.studentProfileId, studentName)
      sums[category].total += score
      sums[category].count += 1
    }
  }

  const result = {} as Record<ATLCategory, ATLCategorySummary>
  for (const category of ATL_CATEGORIES) {
    result[category] = {
      average: sums[category].count > 0 ? sums[category].total / sums[category].count : null,
      buckets: toBuckets(perCategory[category]),
    }
  }
  return result
}
