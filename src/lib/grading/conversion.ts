/**
 * Score conversion and letter grade calculation.
 *
 * Each standard score (1, 1.5, 2, 2.5, 3, 3.5, 4) maps to an internal
 * contribution value (0.5 – 1.0).  The average of the four internal values
 * for Standards 1–4 determines the letter grade via fixed thresholds.
 */

// Re-exported from constants for convenience — kept as the single source of
// truth in constants.ts but exposed here so callers only need one import.
export const STANDARD_SCORE_MAP: Record<number, number> = {
  1: 0.5,
  1.5: 0.6,
  2: 0.7,
  2.5: 0.75,
  3: 0.8,
  3.5: 0.9,
  4: 1.0,
}

/**
 * Convert a standard score (1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4) to its internal
 * contribution value.  Throws if the score is not a recognised key.
 */
export function standardScoreToInternal(score: number): number {
  const value = STANDARD_SCORE_MAP[score]
  if (value === undefined) {
    throw new Error(
      `standardScoreToInternal: unrecognised score "${score}". ` +
        `Valid values: ${Object.keys(STANDARD_SCORE_MAP).join(', ')}`
    )
  }
  return value
}

/**
 * Map an average internal value (0–1) to a letter grade.
 *
 * Thresholds (upper-inclusive):
 *   <= 0.59 → F
 *   <= 0.62 → D-
 *   <= 0.66 → D
 *   <= 0.69 → D+
 *   <= 0.72 → C-
 *   <= 0.76 → C
 *   <= 0.79 → C+
 *   <= 0.82 → B-
 *   <= 0.86 → B
 *   <= 0.89 → B+
 *   <= 0.92 → A-
 *   <= 1.00 → A
 */
export function internalAverageToLetterGrade(average: number): string {
  if (average <= 0.59) return 'F'
  if (average <= 0.62) return 'D-'
  if (average <= 0.66) return 'D'
  if (average <= 0.69) return 'D+'
  if (average <= 0.72) return 'C-'
  if (average <= 0.76) return 'C'
  if (average <= 0.79) return 'C+'
  if (average <= 0.82) return 'B-'
  if (average <= 0.86) return 'B'
  if (average <= 0.89) return 'B+'
  if (average <= 0.92) return 'A-'
  return 'A'
}

/**
 * Given the four standard scores (already in internal form, i.e. post-map),
 * compute the arithmetic average and derive the letter grade.
 */
export function calculateLetterGrade(
  std1: number,
  std2: number,
  std3: number,
  std4: number
): { average: number; letterGrade: string } {
  const average = (std1 + std2 + std3 + std4) / 4
  const letterGrade = internalAverageToLetterGrade(average)
  return { average, letterGrade }
}

export interface OverallGradeInput {
  s1: number
  s2: number
  s3: number
  s4: number
}

export interface OverallGradeResult {
  internal: { s1: number; s2: number; s3: number; s4: number }
  average: number
  letterGrade: string
}

/**
 * Full pipeline: accept raw standard scores, convert to internal values,
 * average them, and return the letter grade.
 */
export function calculateOverallGrade(scores: OverallGradeInput): OverallGradeResult {
  const internal = {
    s1: standardScoreToInternal(scores.s1),
    s2: standardScoreToInternal(scores.s2),
    s3: standardScoreToInternal(scores.s3),
    s4: standardScoreToInternal(scores.s4),
  }
  const { average, letterGrade } = calculateLetterGrade(
    internal.s1,
    internal.s2,
    internal.s3,
    internal.s4
  )
  return { internal, average, letterGrade }
}
