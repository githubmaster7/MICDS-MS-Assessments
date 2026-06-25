/**
 * Standard 1 (Movement Skills) scoring logic.
 *
 * The teacher assigns each skill a color score:
 *   1 = red
 *   2 = yellow
 *   3 = light-green
 *   4 = bright-green
 *
 * Scoring thresholds:
 *   4   = Everything green (>=3) AND more than half bright-green (=4)
 *   3.5 = Everything green AND less than half bright-green
 *   3   = More than half green (>=3), no red
 *   2.5 = 40–49% green, no red
 *   2   = 30–39% green OR 1–3 red
 *   1.5 = 20–29% green OR 4–6 red
 *   1   = less than 20% green OR more than 6 red
 */

export interface SkillScore {
  skillId: string
  score: 1 | 2 | 3 | 4
}

export interface Standard1Result {
  score: 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4
  totalSkills: number
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

export function calculateStandard1(skills: SkillScore[]): Standard1Result {
  if (skills.length === 0) {
    throw new Error('calculateStandard1: skills array must not be empty')
  }

  const totalSkills = skills.length

  const breakdown = {
    red: 0,
    yellow: 0,
    lightGreen: 0,
    brightGreen: 0,
  }

  for (const s of skills) {
    if (s.score === 1) breakdown.red++
    else if (s.score === 2) breakdown.yellow++
    else if (s.score === 3) breakdown.lightGreen++
    else if (s.score === 4) breakdown.brightGreen++
  }

  const greenCount = breakdown.lightGreen + breakdown.brightGreen
  const brightGreenCount = breakdown.brightGreen
  const redCount = breakdown.red
  const greenPercent = (greenCount / totalSkills) * 100

  // Determine score from most to least favorable
  let score: 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4

  const allGreen = greenCount === totalSkills
  const moreThanHalfGreen = greenCount / totalSkills > 0.5
  const moreThanHalfBrightGreen = brightGreenCount / totalSkills > 0.5

  if (allGreen && moreThanHalfBrightGreen) {
    score = 4
  } else if (allGreen && !moreThanHalfBrightGreen) {
    // Includes exactly half or less bright-green — spec says "less than half"
    score = 3.5
  } else if (moreThanHalfGreen && redCount === 0) {
    score = 3
  } else if (greenPercent >= 40 && greenPercent < 50 && redCount === 0) {
    score = 2.5
  } else if ((greenPercent >= 30 && greenPercent < 40) || (redCount >= 1 && redCount <= 3)) {
    score = 2
  } else if ((greenPercent >= 20 && greenPercent < 30) || (redCount >= 4 && redCount <= 6)) {
    score = 1.5
  } else {
    // less than 20% green OR more than 6 red
    score = 1
  }

  return {
    score,
    totalSkills,
    greenCount,
    brightGreenCount,
    redCount,
    greenPercent,
    breakdown,
  }
}
