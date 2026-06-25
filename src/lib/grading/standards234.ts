/**
 * Standards 2, 3, 4 share identical scoring logic.
 *
 * Items are rated 1–4 (same color mapping as Standard 1):
 *   1 = red
 *   2 = yellow
 *   3 = light-green
 *   4 = bright-green
 *
 * Scoring thresholds:
 *   4   = Everything green AND more than half bright-green
 *   3.5 = Everything green AND a quarter bright-green  (>=25% bright-green)
 *   3   = 80% or more green, no red
 *   2.5 = 70–79% green, no red
 *   2   = 50–69% green OR 1–3 red
 *   1.5 = 25–49% green OR 4–5 red
 *   1   = less than 25% green OR 6 or more red
 */

export interface ItemScore {
  itemId: string
  score: 1 | 2 | 3 | 4
}

export interface StandardResult {
  score: 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4
  totalItems: number
  greenCount: number
  brightGreenCount: number
  redCount: number
  greenPercent: number
  breakdown: {
    red: number
    yellow: number
    lightGreen: number
    brightGreen: number
  }
}

export function calculateStandard234(items: ItemScore[]): StandardResult {
  if (items.length === 0) {
    throw new Error('calculateStandard234: items array must not be empty')
  }

  const totalItems = items.length

  const breakdown = {
    red: 0,
    yellow: 0,
    lightGreen: 0,
    brightGreen: 0,
  }

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
  const atLeastQuarterBrightGreen = brightGreenCount / totalItems >= 0.25

  let score: 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4

  if (allGreen && moreThanHalfBrightGreen) {
    score = 4
  } else if (allGreen && atLeastQuarterBrightGreen) {
    // spec: "a quarter being bright green" — interpreted as >=25%
    score = 3.5
  } else if (greenPercent >= 80 && redCount === 0) {
    score = 3
  } else if (greenPercent >= 70 && greenPercent < 80 && redCount === 0) {
    score = 2.5
  } else if ((greenPercent >= 50 && greenPercent < 70) || (redCount >= 1 && redCount <= 3)) {
    score = 2
  } else if ((greenPercent >= 25 && greenPercent < 50) || (redCount >= 4 && redCount <= 5)) {
    score = 1.5
  } else {
    // less than 25% green OR 6+ red
    score = 1
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
