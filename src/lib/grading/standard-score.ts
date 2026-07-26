/**
 * Standard score calculation — the single source of truth for turning a set
 * of individually-rated items (1–4, "red/yellow/light-green/bright-green")
 * into one standard's rolled-up score (1–4 in half-point steps). Used
 * identically for Standard 1 (skill scores), Standards 2 & 3 (prompt
 * scores), and Standard 4 (prompt scores + teacher/student ratings) — there
 * is deliberately no per-standard variant of this function; every caller
 * (teacher grading APIs, GradingInterface, analytics) goes through this one
 * implementation so a given set of item scores always produces the same
 * standard score everywhere it's shown.
 *
 * Item colors:
 *   1 = red    (a "major deficiency")
 *   2 = yellow
 *   3 = light-green   \_ together, "green" — this standard's performance %
 *   4 = bright-green  /
 *
 * Conditions are evaluated in order; the first match wins:
 *   1.   Missing submission (no items), 6+ major deficiencies, or
 *        performance <= 20%                                          → 1
 *   2.   4-5 major deficiencies, or performance 21-29%                → 1.5
 *   3.   At least 1 major deficiency, or performance 30-39%           → 2
 *   4.   Performance 40-49%                                           → 2.5
 *   5.   Performance 50-74%                                           → 3
 *   6.   Performance >=75% AND meets the Exceeding benchmark
 *        (every item green, more than half of them bright-green)      → 4
 *   7.   Otherwise (performance >=75%, Exceeding benchmark not met)    → 3.5
 *
 * Because steps 1-3 are checked first, any standard with 1+ major
 * deficiency can score at most 2, regardless of how high its performance
 * percentage is — matching the intent that a major deficiency caps the
 * score even on an otherwise-strong submission.
 */

export interface StandardScoreItem {
  score: 1 | 2 | 3 | 4
}

export interface StandardScoreResult {
  score: 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4
  totalItems: number
  /** "Green" items (score 3 or 4) */
  greenCount: number
  brightGreenCount: number
  /** "Major deficiencies" (score 1) */
  redCount: number
  /** Performance percentage — greenCount / totalItems * 100 */
  greenPercent: number
  breakdown: {
    red: number
    yellow: number
    lightGreen: number
    brightGreen: number
  }
}

const EMPTY_BREAKDOWN = { red: 0, yellow: 0, lightGreen: 0, brightGreen: 0 } as const

export function calculateStandardScore(items: StandardScoreItem[]): StandardScoreResult {
  const totalItems = items.length

  // Rule 1 (missing submission): no items to grade at all.
  if (totalItems === 0) {
    return {
      score: 1,
      totalItems: 0,
      greenCount: 0,
      brightGreenCount: 0,
      redCount: 0,
      greenPercent: 0,
      breakdown: { ...EMPTY_BREAKDOWN },
    }
  }

  const breakdown = { ...EMPTY_BREAKDOWN }
  for (const item of items) {
    if (item.score === 1) breakdown.red++
    else if (item.score === 2) breakdown.yellow++
    else if (item.score === 3) breakdown.lightGreen++
    else if (item.score === 4) breakdown.brightGreen++
  }

  const greenCount = breakdown.lightGreen + breakdown.brightGreen
  const brightGreenCount = breakdown.brightGreen
  const redCount = breakdown.red
  const greenPercent = (greenCount / totalItems) * 100

  const allGreen = greenCount === totalItems
  const moreThanHalfBrightGreen = brightGreenCount / totalItems > 0.5
  const meetsExceedingBenchmark = allGreen && moreThanHalfBrightGreen

  let score: 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4

  if (redCount >= 6 || greenPercent <= 20) {
    score = 1
  } else if ((redCount >= 4 && redCount <= 5) || (greenPercent >= 21 && greenPercent <= 29)) {
    score = 1.5
  } else if (redCount >= 1 || (greenPercent >= 30 && greenPercent <= 39)) {
    score = 2
  } else if (greenPercent >= 40 && greenPercent <= 49) {
    score = 2.5
  } else if (greenPercent >= 50 && greenPercent <= 74) {
    score = 3
  } else if (meetsExceedingBenchmark) {
    score = 4
  } else {
    score = 3.5
  }

  return {
    score,
    totalItems,
    greenCount,
    brightGreenCount,
    redCount,
    greenPercent,
    breakdown,
  }
}
