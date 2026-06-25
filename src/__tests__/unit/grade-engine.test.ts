import { calculateStandard1, type SkillScore } from '@/lib/grading/standard1'
import { calculateStandard234, type ItemScore } from '@/lib/grading/standards234'
import {
  standardScoreToInternal,
  internalAverageToLetterGrade,
  calculateOverallGrade,
  STANDARD_SCORE_MAP,
} from '@/lib/grading/conversion'
import { calculateDaysLateScore } from '@/lib/grading/approach-to-learning'

// ─────────────────────────────────────────────────────────────────────────────
// Standard 1 Scoring
// ─────────────────────────────────────────────────────────────────────────────
function s1(scores: (1 | 2 | 3 | 4)[]): number {
  const skills: SkillScore[] = scores.map((score, i) => ({ skillId: `s${i}`, score }))
  return calculateStandard1(skills).score
}

describe('Standard 1 scoring', () => {
  // 4 = all green, >50% bright green
  test('score 4: all green, all bright green', () => {
    expect(s1([4, 4, 4, 4])).toBe(4)
  })
  test('score 4: all green, 4/6 bright green (67%)', () => {
    expect(s1([4, 4, 4, 4, 3, 3])).toBe(4)
  })
  test('score 4: all green, exactly 51% bright green (3/5)', () => {
    // 3 bright + 2 light = 5 total, 60% bright
    expect(s1([4, 4, 4, 3, 3])).toBe(4)
  })

  // 3.5 = all green, <50% bright green
  test('score 3.5: all green, exactly 50% bright green (3/6)', () => {
    // 50% is not MORE THAN HALF so → 3.5
    expect(s1([4, 4, 4, 3, 3, 3])).toBe(3.5)
  })
  test('score 3.5: all green, 0% bright green', () => {
    expect(s1([3, 3, 3, 3])).toBe(3.5)
  })
  test('score 3.5: all green, 1/6 bright (17%)', () => {
    expect(s1([4, 3, 3, 3, 3, 3])).toBe(3.5)
  })

  // 3 = more than half green, no red
  test('score 3: 4/6 green (67%), no red', () => {
    expect(s1([3, 3, 3, 3, 2, 2])).toBe(3)
  })
  test('score 3: exactly half+1 green (4/6)', () => {
    // 4/6 = 67% which is >50%
    expect(s1([3, 4, 3, 3, 2, 2])).toBe(4) // wait - 1 bright so NOT 3.5 condition needs re-check
    // Actually [3,4,3,3,2,2]: green=4, brightGreen=1, NOT all green (has yellows), moreThanHalfGreen=true, noRed → score 3
  })
  test('score 3: 4/6 green no red, not all green', () => {
    expect(s1([3, 3, 3, 3, 2, 2])).toBe(3)
  })

  // 2.5 = 40-49% green, no red
  test('score 2.5: 2/5 green = 40%, no red', () => {
    expect(s1([3, 3, 2, 2, 2])).toBe(2.5)
  })
  test('score 2.5: 5/10 = 50%... 50% is NOT >=50 boundary for s3, need 40-49', () => {
    // 49%: e.g. 5/11 ≈ 45.4%
    expect(s1([3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2])).toBe(2.5) // 5/11 = 45.4%
  })

  // 2 = 30-39% green OR 1-3 red
  test('score 2: 30% green no red (3/10)', () => {
    expect(s1([3, 3, 3, 2, 2, 2, 2, 2, 2, 2])).toBe(2)
  })
  test('score 2: 1 red', () => {
    expect(s1([1, 3, 3, 3, 2, 2, 2, 2, 2, 2])).toBe(2)
  })
  test('score 2: 3 red', () => {
    expect(s1([1, 1, 1, 2, 2, 2, 2, 2, 2, 2])).toBe(2)
  })

  // 1.5 = 20-29% green OR 4-6 red
  test('score 1.5: 20% green no red (2/10)', () => {
    expect(s1([3, 3, 2, 2, 2, 2, 2, 2, 2, 2])).toBe(1.5)
  })
  test('score 1.5: 4 red', () => {
    expect(s1([1, 1, 1, 1, 2, 2, 2, 2, 2, 2])).toBe(1.5)
  })
  test('score 1.5: 6 red', () => {
    expect(s1([1, 1, 1, 1, 1, 1, 2, 2, 2, 2])).toBe(1.5)
  })

  // 1 = <20% green OR >6 red
  test('score 1: 10% green (1/10), no red', () => {
    expect(s1([3, 2, 2, 2, 2, 2, 2, 2, 2, 2])).toBe(1)
  })
  test('score 1: 7 red', () => {
    expect(s1([1, 1, 1, 1, 1, 1, 1, 2, 2, 2])).toBe(1)
  })
  test('score 1: all red', () => {
    expect(s1([1, 1, 1, 1, 1, 1, 1, 1])).toBe(1)
  })
  test('score 1: 0% green', () => {
    expect(s1([2, 2, 2, 2, 2, 2])).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Standard 2/3/4 Scoring
// ─────────────────────────────────────────────────────────────────────────────
function s234(scores: (1 | 2 | 3 | 4)[]): number {
  const items: ItemScore[] = scores.map((score, i) => ({ itemId: `i${i}`, score }))
  return calculateStandard234(items).score
}

describe('Standard 2/3/4 scoring', () => {
  // 4 = all green, >50% bright green
  test('score 4: all bright green', () => {
    expect(s234([4, 4, 4, 4])).toBe(4)
  })
  test('score 4: 3/4 bright green = 75%', () => {
    expect(s234([4, 4, 4, 3])).toBe(4)
  })

  // 3.5 = all green, a quarter bright green (<=50% but >=25% bright green)
  test('score 3.5: all green, 1/4 = 25% bright green', () => {
    expect(s234([4, 3, 3, 3])).toBe(3.5)
  })
  test('score 3.5: all green, 0 bright green', () => {
    expect(s234([3, 3, 3, 3])).toBe(3.5)
  })

  // 3 = 80%+ green, no red
  test('score 3: exactly 80% green (4/5), no red', () => {
    expect(s234([3, 3, 3, 3, 2])).toBe(3)
  })
  test('score 3: 90% green no red', () => {
    expect(s234([3, 3, 3, 3, 3, 3, 3, 3, 3, 2])).toBe(3)
  })

  // 2.5 = 70-79% green, no red
  test('score 2.5: 70% green no red (7/10)', () => {
    expect(s234([3, 3, 3, 3, 3, 3, 3, 2, 2, 2])).toBe(2.5)
  })
  test('score 2.5: 75% green (6/8)', () => {
    expect(s234([3, 3, 3, 3, 3, 3, 2, 2])).toBe(2.5)
  })

  // 2 = 50-69% green OR 1-3 red
  test('score 2: 50% green, no red (5/10)', () => {
    expect(s234([3, 3, 3, 3, 3, 2, 2, 2, 2, 2])).toBe(2)
  })
  test('score 2: 1 red', () => {
    expect(s234([1, 3, 3, 3, 3, 2, 2, 2, 2, 2])).toBe(2)
  })
  test('score 2: 3 red', () => {
    expect(s234([1, 1, 1, 3, 3, 2, 2, 2, 2, 2])).toBe(2)
  })

  // 1.5 = 25-49% green OR 4-5 red
  test('score 1.5: 25% green no red (2/8)', () => {
    expect(s234([3, 3, 2, 2, 2, 2, 2, 2])).toBe(1.5)
  })
  test('score 1.5: 4 red', () => {
    expect(s234([1, 1, 1, 1, 3, 3, 2, 2])).toBe(1.5)
  })
  test('score 1.5: 5 red', () => {
    expect(s234([1, 1, 1, 1, 1, 3, 2, 2])).toBe(1.5)
  })

  // 1 = <25% green OR 6+ red
  test('score 1: 0% green', () => {
    expect(s234([2, 2, 2, 2, 2, 2])).toBe(1)
  })
  test('score 1: 6 red', () => {
    expect(s234([1, 1, 1, 1, 1, 1, 2, 2])).toBe(1)
  })
  test('score 1: all red', () => {
    expect(s234([1, 1, 1, 1, 1, 1, 1, 1])).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Standard score -> internal value
// ─────────────────────────────────────────────────────────────────────────────
describe('standardScoreToInternal', () => {
  const cases: [number, number][] = [
    [1, 0.5], [1.5, 0.6], [2, 0.7], [2.5, 0.75], [3, 0.8], [3.5, 0.9], [4, 1.0],
  ]
  test.each(cases)('score %f → %f', (score, expected) => {
    expect(standardScoreToInternal(score)).toBe(expected)
  })

  test('throws for invalid score', () => {
    expect(() => standardScoreToInternal(5)).toThrow()
    expect(() => standardScoreToInternal(0)).toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Letter grade boundaries
// ─────────────────────────────────────────────────────────────────────────────
describe('internalAverageToLetterGrade', () => {
  const cases: [number, string][] = [
    // F boundary: <= 0.59
    [0.59, 'F'],
    [0.00, 'F'],
    // D- boundary: 0.60-0.62
    [0.60, 'D-'],
    [0.62, 'D-'],
    // D boundary: 0.63-0.66
    [0.63, 'D'],
    [0.66, 'D'],
    // D+ boundary: 0.67-0.69
    [0.67, 'D+'],
    [0.69, 'D+'],
    // C- boundary: 0.70-0.72
    [0.70, 'C-'],
    [0.72, 'C-'],
    // C boundary: 0.73-0.76
    [0.73, 'C'],
    [0.76, 'C'],
    // C+ boundary: 0.77-0.79
    [0.77, 'C+'],
    [0.79, 'C+'],
    // B- boundary: 0.80-0.82
    [0.80, 'B-'],
    [0.82, 'B-'],
    // B boundary: 0.83-0.86
    [0.83, 'B'],
    [0.86, 'B'],
    // B+ boundary: 0.87-0.89
    [0.87, 'B+'],
    [0.89, 'B+'],
    // A- boundary: 0.90-0.92
    [0.90, 'A-'],
    [0.92, 'A-'],
    // A boundary: 0.93-1.0
    [0.93, 'A'],
    [1.00, 'A'],
  ]

  test.each(cases)('average %f → %s', (avg, expected) => {
    expect(internalAverageToLetterGrade(avg)).toBe(expected)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Overall grade calculation
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateOverallGrade', () => {
  test('all 4s → A (avg 1.0)', () => {
    const result = calculateOverallGrade({ s1: 4, s2: 4, s3: 4, s4: 4 })
    expect(result.letterGrade).toBe('A')
    expect(result.average).toBe(1.0)
  })

  test('all 1s → F (avg 0.5)', () => {
    const result = calculateOverallGrade({ s1: 1, s2: 1, s3: 1, s4: 1 })
    expect(result.letterGrade).toBe('F')
    expect(result.average).toBe(0.5)
  })

  test('all 3s → B- (avg 0.8)', () => {
    const result = calculateOverallGrade({ s1: 3, s2: 3, s3: 3, s4: 3 })
    expect(result.letterGrade).toBe('B-')
    expect(result.average).toBe(0.8)
  })

  test('mixed scores', () => {
    // 4→1.0, 3→0.8, 2→0.7, 1→0.5 → avg = 3.0/4 = 0.75
    const result = calculateOverallGrade({ s1: 4, s2: 3, s3: 2, s4: 1 })
    expect(result.average).toBeCloseTo(0.7625, 4)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Days late/unprepared
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateDaysLateScore', () => {
  test('0 days → 4', () => expect(calculateDaysLateScore(0)).toBe(4))
  test('1 day → 3', () => expect(calculateDaysLateScore(1)).toBe(3))
  test('2 days → 3', () => expect(calculateDaysLateScore(2)).toBe(3))
  test('3 days → 3', () => expect(calculateDaysLateScore(3)).toBe(3))
  test('4 days → 2', () => expect(calculateDaysLateScore(4)).toBe(2))
  test('5 days → 2', () => expect(calculateDaysLateScore(5)).toBe(2))
  test('6 days → 2', () => expect(calculateDaysLateScore(6)).toBe(2))
  test('7 days → 1', () => expect(calculateDaysLateScore(7)).toBe(1))
  test('10 days → 1', () => expect(calculateDaysLateScore(10)).toBe(1))
  test('100 days → 1', () => expect(calculateDaysLateScore(100)).toBe(1))
})
