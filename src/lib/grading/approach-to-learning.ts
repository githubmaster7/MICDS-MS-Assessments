/**
 * Approach to Learning (ATL) grading.
 *
 * Days late / unprepared → score:
 *   0 days  → 4
 *   1–3     → 3
 *   4–6     → 2
 *   7+      → 1
 *
 * The overall ATL score combines:
 *   - responsiblePrepared  (teacher-rated 1–4)
 *   - respectfulWorks      (teacher-rated 1–4)
 *   - effortTeacherScore   (teacher-rated 1–4)
 *   - effortStudentScore   (student self-rated 1–4)
 *   - daysLateUnprepared   (converted to 1–4 via calculateDaysLateScore)
 *
 * The calculated score is the arithmetic mean of the five values, rounded to
 * two decimal places.
 */

export interface ATLInput {
  /** Teacher rating 1–4: responsible & prepared */
  responsiblePrepared: number
  /** Teacher rating 1–4: respectful, works well with others */
  respectfulWorks: number
  /** Teacher effort rating 1–4 */
  effortTeacherScore: number
  /** Student effort self-rating 1–4 */
  effortStudentScore: number
  /** Raw count of days late or unprepared */
  daysLateUnprepared: number
}

export interface ATLResult {
  /** Converted score for days late/unprepared (1 | 2 | 3 | 4) */
  daysLateScore: 1 | 2 | 3 | 4
  /** Arithmetic mean of all five components, rounded to 2 dp */
  calculatedScore: number
  /** Individual component values used in the calculation */
  components: {
    responsiblePrepared: number
    respectfulWorks: number
    effortTeacherScore: number
    effortStudentScore: number
    daysLateScore: number
  }
}

/**
 * Convert a raw days-late / unprepared count to a 1–4 score.
 */
export function calculateDaysLateScore(days: number): 1 | 2 | 3 | 4 {
  if (days < 0) {
    throw new Error(`calculateDaysLateScore: days must be >= 0, got ${days}`)
  }
  if (days === 0) return 4
  if (days <= 3) return 3
  if (days <= 6) return 2
  return 1
}

/**
 * Calculate the overall ATL result from an ATLInput record.
 * Validates that all rated values are in the range 1–4.
 */
export function calculateApproachToLearning(record: ATLInput): ATLResult {
  const ratedFields: Array<keyof Omit<ATLInput, 'daysLateUnprepared'>> = [
    'responsiblePrepared',
    'respectfulWorks',
    'effortTeacherScore',
    'effortStudentScore',
  ]

  for (const field of ratedFields) {
    const val = record[field]
    if (!Number.isFinite(val) || val < 1 || val > 4) {
      throw new Error(
        `calculateApproachToLearning: field "${field}" must be between 1 and 4, got ${val}`
      )
    }
  }

  if (!Number.isInteger(record.daysLateUnprepared) || record.daysLateUnprepared < 0) {
    throw new Error(
      `calculateApproachToLearning: daysLateUnprepared must be a non-negative integer, got ${record.daysLateUnprepared}`
    )
  }

  const daysLateScore = calculateDaysLateScore(record.daysLateUnprepared)

  const components = {
    responsiblePrepared: record.responsiblePrepared,
    respectfulWorks: record.respectfulWorks,
    effortTeacherScore: record.effortTeacherScore,
    effortStudentScore: record.effortStudentScore,
    daysLateScore,
  }

  const sum =
    components.responsiblePrepared +
    components.respectfulWorks +
    components.effortTeacherScore +
    components.effortStudentScore +
    components.daysLateScore

  const calculatedScore = Math.round((sum / 5) * 100) / 100

  return { daysLateScore, calculatedScore, components }
}
