/**
 * Score conversion and letter grade boundary tests.
 *
 * standardScoreToInternal mapping:
 *   1   → 0.5
 *   1.5 → 0.6
 *   2   → 0.7
 *   2.5 → 0.75
 *   3   → 0.8
 *   3.5 → 0.9
 *   4   → 1.0
 *
 * internalAverageToLetterGrade thresholds (upper-inclusive):
 *   <=0.59 → F
 *   <=0.62 → D-
 *   <=0.66 → D
 *   <=0.69 → D+
 *   <=0.72 → C-
 *   <=0.76 → C
 *   <=0.79 → C+
 *   <=0.82 → B-
 *   <=0.86 → B
 *   <=0.89 → B+
 *   <=0.92 → A-
 *   <=1.00 → A
 */

import {
  standardScoreToInternal,
  internalAverageToLetterGrade,
  calculateLetterGrade,
  calculateOverallGrade,
  STANDARD_SCORE_MAP,
} from '@/lib/grading/conversion'

// ─── standardScoreToInternal ──────────────────────────────────────────────────

describe('standardScoreToInternal', () => {
  it('1 → 0.5', () => expect(standardScoreToInternal(1)).toBe(0.5))
  it('1.5 → 0.6', () => expect(standardScoreToInternal(1.5)).toBe(0.6))
  it('2 → 0.7', () => expect(standardScoreToInternal(2)).toBe(0.7))
  it('2.5 → 0.75', () => expect(standardScoreToInternal(2.5)).toBe(0.75))
  it('3 → 0.8', () => expect(standardScoreToInternal(3)).toBe(0.8))
  it('3.5 → 0.9', () => expect(standardScoreToInternal(3.5)).toBe(0.9))
  it('4 → 1.0', () => expect(standardScoreToInternal(4)).toBe(1.0))

  it('throws for score 0', () => {
    expect(() => standardScoreToInternal(0)).toThrow()
  })

  it('throws for score 5', () => {
    expect(() => standardScoreToInternal(5)).toThrow()
  })

  it('throws for score 2.2 (not a recognised key)', () => {
    expect(() => standardScoreToInternal(2.2)).toThrow()
  })

  it('throws for negative score', () => {
    expect(() => standardScoreToInternal(-1)).toThrow()
  })

  it('STANDARD_SCORE_MAP covers all 7 valid scores', () => {
    const keys = Object.keys(STANDARD_SCORE_MAP).map(Number).sort((a, b) => a - b)
    expect(keys).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4])
  })
})

// ─── internalAverageToLetterGrade ─────────────────────────────────────────────

describe('internalAverageToLetterGrade — every grade boundary', () => {
  // ── F ──────────────────────────────────────────────────────────────────────
  it('0.00 → F', () => expect(internalAverageToLetterGrade(0.00)).toBe('F'))
  it('0.50 → F', () => expect(internalAverageToLetterGrade(0.50)).toBe('F'))
  it('0.59 → F (upper boundary)', () => expect(internalAverageToLetterGrade(0.59)).toBe('F'))

  // ── D- ─────────────────────────────────────────────────────────────────────
  it('0.60 → D- (lower boundary)', () => expect(internalAverageToLetterGrade(0.60)).toBe('D-'))
  it('0.61 → D-', () => expect(internalAverageToLetterGrade(0.61)).toBe('D-'))
  it('0.62 → D- (upper boundary)', () => expect(internalAverageToLetterGrade(0.62)).toBe('D-'))

  // ── D ──────────────────────────────────────────────────────────────────────
  it('0.63 → D (lower boundary)', () => expect(internalAverageToLetterGrade(0.63)).toBe('D'))
  it('0.65 → D', () => expect(internalAverageToLetterGrade(0.65)).toBe('D'))
  it('0.66 → D (upper boundary)', () => expect(internalAverageToLetterGrade(0.66)).toBe('D'))

  // ── D+ ─────────────────────────────────────────────────────────────────────
  it('0.67 → D+ (lower boundary)', () => expect(internalAverageToLetterGrade(0.67)).toBe('D+'))
  it('0.68 → D+', () => expect(internalAverageToLetterGrade(0.68)).toBe('D+'))
  it('0.69 → D+ (upper boundary)', () => expect(internalAverageToLetterGrade(0.69)).toBe('D+'))

  // ── C- ─────────────────────────────────────────────────────────────────────
  it('0.70 → C- (lower boundary)', () => expect(internalAverageToLetterGrade(0.70)).toBe('C-'))
  it('0.71 → C-', () => expect(internalAverageToLetterGrade(0.71)).toBe('C-'))
  it('0.72 → C- (upper boundary)', () => expect(internalAverageToLetterGrade(0.72)).toBe('C-'))

  // ── C ──────────────────────────────────────────────────────────────────────
  it('0.73 → C (lower boundary)', () => expect(internalAverageToLetterGrade(0.73)).toBe('C'))
  it('0.75 → C', () => expect(internalAverageToLetterGrade(0.75)).toBe('C'))
  it('0.76 → C (upper boundary)', () => expect(internalAverageToLetterGrade(0.76)).toBe('C'))

  // ── C+ ─────────────────────────────────────────────────────────────────────
  it('0.77 → C+ (lower boundary)', () => expect(internalAverageToLetterGrade(0.77)).toBe('C+'))
  it('0.78 → C+', () => expect(internalAverageToLetterGrade(0.78)).toBe('C+'))
  it('0.79 → C+ (upper boundary)', () => expect(internalAverageToLetterGrade(0.79)).toBe('C+'))

  // ── B- ─────────────────────────────────────────────────────────────────────
  it('0.80 → B- (lower boundary)', () => expect(internalAverageToLetterGrade(0.80)).toBe('B-'))
  it('0.81 → B-', () => expect(internalAverageToLetterGrade(0.81)).toBe('B-'))
  it('0.82 → B- (upper boundary)', () => expect(internalAverageToLetterGrade(0.82)).toBe('B-'))

  // ── B ──────────────────────────────────────────────────────────────────────
  it('0.83 → B (lower boundary)', () => expect(internalAverageToLetterGrade(0.83)).toBe('B'))
  it('0.85 → B', () => expect(internalAverageToLetterGrade(0.85)).toBe('B'))
  it('0.86 → B (upper boundary)', () => expect(internalAverageToLetterGrade(0.86)).toBe('B'))

  // ── B+ ─────────────────────────────────────────────────────────────────────
  it('0.87 → B+ (lower boundary)', () => expect(internalAverageToLetterGrade(0.87)).toBe('B+'))
  it('0.88 → B+', () => expect(internalAverageToLetterGrade(0.88)).toBe('B+'))
  it('0.89 → B+ (upper boundary)', () => expect(internalAverageToLetterGrade(0.89)).toBe('B+'))

  // ── A- ─────────────────────────────────────────────────────────────────────
  it('0.90 → A- (lower boundary)', () => expect(internalAverageToLetterGrade(0.90)).toBe('A-'))
  it('0.91 → A-', () => expect(internalAverageToLetterGrade(0.91)).toBe('A-'))
  it('0.92 → A- (upper boundary)', () => expect(internalAverageToLetterGrade(0.92)).toBe('A-'))

  // ── A ──────────────────────────────────────────────────────────────────────
  it('0.93 → A (lower boundary)', () => expect(internalAverageToLetterGrade(0.93)).toBe('A'))
  it('0.97 → A', () => expect(internalAverageToLetterGrade(0.97)).toBe('A'))
  it('1.00 → A (upper boundary)', () => expect(internalAverageToLetterGrade(1.00)).toBe('A'))
})

// ─── calculateLetterGrade ─────────────────────────────────────────────────────

describe('calculateLetterGrade (four internal values)', () => {
  it('all 1.0 → A, average 1.0', () => {
    const { average, letterGrade } = calculateLetterGrade(1.0, 1.0, 1.0, 1.0)
    expect(average).toBe(1.0)
    expect(letterGrade).toBe('A')
  })

  it('all 0.5 → F, average 0.5', () => {
    const { average, letterGrade } = calculateLetterGrade(0.5, 0.5, 0.5, 0.5)
    expect(average).toBe(0.5)
    expect(letterGrade).toBe('F')
  })

  it('all 0.8 → B-, average 0.8', () => {
    const { average, letterGrade } = calculateLetterGrade(0.8, 0.8, 0.8, 0.8)
    expect(average).toBe(0.8)
    expect(letterGrade).toBe('B-')
  })

  it('mixed values — correctly averages and grades', () => {
    // 1.0 + 0.8 + 0.7 + 0.5 = 3.0 / 4 = 0.75
    const { average, letterGrade } = calculateLetterGrade(1.0, 0.8, 0.7, 0.5)
    expect(average).toBeCloseTo(0.75, 10)
    expect(letterGrade).toBe('C')
  })

  it('average landing exactly on grade boundary 0.62 → D-', () => {
    // Need four values that average to 0.62: e.g. 0.60+0.62+0.63+0.63=2.48/4=0.62
    const { average, letterGrade } = calculateLetterGrade(0.60, 0.62, 0.63, 0.63)
    expect(average).toBeCloseTo(0.62, 10)
    expect(letterGrade).toBe('D-')
  })
})

// ─── calculateOverallGrade ───────────────────────────────────────────────────

describe('calculateOverallGrade (full pipeline from raw standard scores)', () => {
  it('all 4s → internal all 1.0, average 1.0, grade A', () => {
    const result = calculateOverallGrade({ s1: 4, s2: 4, s3: 4, s4: 4 })
    expect(result.internal.s1).toBe(1.0)
    expect(result.internal.s2).toBe(1.0)
    expect(result.internal.s3).toBe(1.0)
    expect(result.internal.s4).toBe(1.0)
    expect(result.average).toBe(1.0)
    expect(result.letterGrade).toBe('A')
  })

  it('all 1s → internal all 0.5, average 0.5, grade F', () => {
    const result = calculateOverallGrade({ s1: 1, s2: 1, s3: 1, s4: 1 })
    expect(result.internal.s1).toBe(0.5)
    expect(result.internal.s2).toBe(0.5)
    expect(result.internal.s3).toBe(0.5)
    expect(result.internal.s4).toBe(0.5)
    expect(result.average).toBe(0.5)
    expect(result.letterGrade).toBe('F')
  })

  it('all 3s → internal all 0.8, average 0.8, grade B-', () => {
    const result = calculateOverallGrade({ s1: 3, s2: 3, s3: 3, s4: 3 })
    expect(result.average).toBe(0.8)
    expect(result.letterGrade).toBe('B-')
  })

  it('all 3.5s → internal all 0.9, average 0.9, grade A-', () => {
    const result = calculateOverallGrade({ s1: 3.5, s2: 3.5, s3: 3.5, s4: 3.5 })
    expect(result.average).toBe(0.9)
    expect(result.letterGrade).toBe('A-')
  })

  it('all 2s → internal all 0.7, average 0.7, grade C-', () => {
    const result = calculateOverallGrade({ s1: 2, s2: 2, s3: 2, s4: 2 })
    expect(result.average).toBe(0.7)
    expect(result.letterGrade).toBe('C-')
  })

  it('mixed: 4, 3, 2, 1 → correct internals, average, and grade', () => {
    const result = calculateOverallGrade({ s1: 4, s2: 3, s3: 2, s4: 1 })
    expect(result.internal.s1).toBe(1.0)
    expect(result.internal.s2).toBe(0.8)
    expect(result.internal.s3).toBe(0.7)
    expect(result.internal.s4).toBe(0.5)
    // (1.0 + 0.8 + 0.7 + 0.5) / 4 = 3.0 / 4 = 0.75
    expect(result.average).toBeCloseTo(0.75, 10)
    expect(result.letterGrade).toBe('C')
  })

  it('mixed: 4, 4, 2, 2 → average 0.85, grade B', () => {
    // (1.0+1.0+0.7+0.7)/4 = 3.4/4 = 0.85
    const result = calculateOverallGrade({ s1: 4, s2: 4, s3: 2, s4: 2 })
    expect(result.average).toBeCloseTo(0.85, 10)
    expect(result.letterGrade).toBe('B')
  })

  it('mixed: 3.5, 2.5, 2, 1 → correct grade', () => {
    // (0.9+0.75+0.7+0.5)/4 = 2.85/4 = 0.7125
    const result = calculateOverallGrade({ s1: 3.5, s2: 2.5, s3: 2, s4: 1 })
    expect(result.average).toBeCloseTo(0.7125, 10)
    expect(result.letterGrade).toBe('C-')
  })

  it('throws for invalid standard score', () => {
    expect(() => calculateOverallGrade({ s1: 5, s2: 3, s3: 3, s4: 3 })).toThrow()
  })

  it('result object contains internal sub-object with all four keys', () => {
    const result = calculateOverallGrade({ s1: 2, s2: 2.5, s3: 3, s4: 3.5 })
    expect(result.internal).toHaveProperty('s1')
    expect(result.internal).toHaveProperty('s2')
    expect(result.internal).toHaveProperty('s3')
    expect(result.internal).toHaveProperty('s4')
    expect(result).toHaveProperty('average')
    expect(result).toHaveProperty('letterGrade')
  })
})
