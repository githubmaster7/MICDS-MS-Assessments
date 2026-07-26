/**
 * Score conversion and letter grade calculation.
 *
 * Each standard score (1, 1.5, 2, 2.5, 3, 3.5, 4) maps to an internal
 * contribution value (0.5 – 1.0).  The average of the four internal values
 * for Standards 1–4 determines the letter grade via fixed thresholds.
 */

// The single source of truth for standard-score → internal-contribution
// mapping. Do not duplicate this elsewhere.
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

const SORTED_SCORE_ANCHORS = Object.entries(STANDARD_SCORE_MAP)
  .map(([k, v]) => [Number(k), v] as const)
  .sort((a, b) => a[0] - b[0])

/**
 * Convert a CONTINUOUS raw score (e.g. a cross-class weighted average like
 * 3.62 — not necessarily one of the 7 discrete standard-score values) onto
 * the same 0.5–1.0 internal contribution scale as STANDARD_SCORE_MAP, via
 * piecewise-linear interpolation between its anchor points.
 *
 * Used only for the cross-class cumulative grade below — a single class's
 * own grade always uses the exact discrete standardScoreToInternal lookup,
 * since an individual GradeCalculationSnapshot's standardNScore is always
 * one of the 7 valid values.
 */
export function interpolateStandardScoreToInternal(score: number): number {
  const anchors = SORTED_SCORE_ANCHORS
  if (score <= anchors[0][0]) return anchors[0][1]
  if (score >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1]
  for (let i = 0; i < anchors.length - 1; i++) {
    const [x0, y0] = anchors[i]
    const [x1, y1] = anchors[i + 1]
    if (score >= x0 && score <= x1) {
      const t = (score - x0) / (x1 - x0)
      return y0 + t * (y1 - y0)
    }
  }
  return anchors[anchors.length - 1][1]
}

export interface CumulativeGradeInput {
  s1: number | null
  s2: number | null
  s3: number | null
  s4: number | null
}

/**
 * The student's overall grade across every class they've been in this year
 * — distinct from a single class's own GradeCalculationSnapshot. Each input
 * is the cross-class average raw score (1-4) for that standard, pooled from
 * every individual teacher-scored item across all classes (the same numbers
 * shown in the "Score Distribution — All Classes" UI). Each average is
 * interpolated onto the internal scale, the four are averaged, and the
 * result is mapped to a letter grade with the same thresholds a single
 * class's grade uses — so a straight-A cumulative record and a straight-A
 * single class both read "A" for the same underlying reason.
 *
 * Returns null if any standard has no data yet, matching the per-class
 * snapshot's own rule of only computing a grade once all 4 standards have
 * at least one score.
 */
export function calculateCumulativeGrade(
  scores: CumulativeGradeInput
): { average: number; letterGrade: string } | null {
  const { s1, s2, s3, s4 } = scores
  if (s1 == null || s2 == null || s3 == null || s4 == null) return null
  const average =
    [s1, s2, s3, s4].map(interpolateStandardScoreToInternal).reduce((a, b) => a + b, 0) / 4
  return { average, letterGrade: internalAverageToLetterGrade(average) }
}
