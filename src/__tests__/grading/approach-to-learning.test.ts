/**
 * Approach to Learning (ATL) grading tests.
 *
 * Days late → score:
 *   0     → 4
 *   1–3   → 3
 *   4–6   → 2
 *   7+    → 1
 *
 * calculateApproachToLearning averages five 1–4 components:
 *   responsiblePrepared, respectfulWorks, effortTeacherScore,
 *   effortStudentScore, daysLateScore
 */

import {
  calculateDaysLateScore,
  calculateApproachToLearning,
  type ATLInput,
} from '@/lib/grading/approach-to-learning'

// ─── calculateDaysLateScore ───────────────────────────────────────────────────

describe('calculateDaysLateScore', () => {
  it('0 days → 4', () => expect(calculateDaysLateScore(0)).toBe(4))

  it('1 day → 3', () => expect(calculateDaysLateScore(1)).toBe(3))
  it('2 days → 3', () => expect(calculateDaysLateScore(2)).toBe(3))
  it('3 days → 3 (upper boundary)', () => expect(calculateDaysLateScore(3)).toBe(3))

  it('4 days → 2 (lower boundary)', () => expect(calculateDaysLateScore(4)).toBe(2))
  it('5 days → 2', () => expect(calculateDaysLateScore(5)).toBe(2))
  it('6 days → 2 (upper boundary)', () => expect(calculateDaysLateScore(6)).toBe(2))

  it('7 days → 1 (lower boundary)', () => expect(calculateDaysLateScore(7)).toBe(1))
  it('8 days → 1', () => expect(calculateDaysLateScore(8)).toBe(1))
  it('10 days → 1', () => expect(calculateDaysLateScore(10)).toBe(1))
  it('30 days → 1', () => expect(calculateDaysLateScore(30)).toBe(1))
  it('100 days → 1', () => expect(calculateDaysLateScore(100)).toBe(1))
  it('999 days → 1', () => expect(calculateDaysLateScore(999)).toBe(1))

  it('throws for negative days', () => {
    expect(() => calculateDaysLateScore(-1)).toThrow()
  })

  it('throws for -100 days', () => {
    expect(() => calculateDaysLateScore(-100)).toThrow()
  })
})

// ─── calculateApproachToLearning ──────────────────────────────────────────────

function makeATL(overrides: Partial<ATLInput> = {}): ATLInput {
  return {
    responsiblePrepared: 4,
    respectfulWorks: 4,
    effortTeacherScore: 4,
    effortStudentScore: 4,
    daysLateUnprepared: 0,
    ...overrides,
  }
}

describe('calculateApproachToLearning — perfect score', () => {
  it('all 4s, 0 days late → calculatedScore 4.0', () => {
    const result = calculateApproachToLearning(makeATL())
    expect(result.daysLateScore).toBe(4)
    expect(result.calculatedScore).toBe(4.0)
  })
})

describe('calculateApproachToLearning — low score', () => {
  it('all 1s, 7+ days late → calculatedScore 1.0', () => {
    const result = calculateApproachToLearning(makeATL({
      responsiblePrepared: 1,
      respectfulWorks: 1,
      effortTeacherScore: 1,
      effortStudentScore: 1,
      daysLateUnprepared: 7,
    }))
    expect(result.daysLateScore).toBe(1)
    expect(result.calculatedScore).toBe(1.0)
  })
})

describe('calculateApproachToLearning — arithmetic mean', () => {
  it('(4+4+4+4+3)/5 = 3.8 (1 day late)', () => {
    // daysLate=1 → daysLateScore=3; all others 4
    const result = calculateApproachToLearning(makeATL({ daysLateUnprepared: 1 }))
    expect(result.daysLateScore).toBe(3)
    expect(result.calculatedScore).toBe(3.8)
  })

  it('(4+4+4+4+2)/5 = 3.6 (4 days late)', () => {
    const result = calculateApproachToLearning(makeATL({ daysLateUnprepared: 4 }))
    expect(result.daysLateScore).toBe(2)
    expect(result.calculatedScore).toBe(3.6)
  })

  it('(4+4+4+4+1)/5 = 3.4 (7 days late)', () => {
    const result = calculateApproachToLearning(makeATL({ daysLateUnprepared: 7 }))
    expect(result.daysLateScore).toBe(1)
    expect(result.calculatedScore).toBe(3.4)
  })

  it('(3+3+3+3+3)/5 = 3.0 (all 3s)', () => {
    const result = calculateApproachToLearning(makeATL({
      responsiblePrepared: 3,
      respectfulWorks: 3,
      effortTeacherScore: 3,
      effortStudentScore: 3,
      daysLateUnprepared: 2, // 1-3 days → score 3
    }))
    expect(result.calculatedScore).toBe(3.0)
  })

  it('mixed components produce correct rounded average', () => {
    // (2+3+4+1+2)/5 = 12/5 = 2.4
    const result = calculateApproachToLearning({
      responsiblePrepared: 2,
      respectfulWorks: 3,
      effortTeacherScore: 4,
      effortStudentScore: 1,
      daysLateUnprepared: 5, // 4-6 days → score 2
    })
    expect(result.daysLateScore).toBe(2)
    expect(result.calculatedScore).toBe(2.4)
  })

  it('rounds to 2 decimal places: (1+2+3+4+3)/5 = 2.6', () => {
    const result = calculateApproachToLearning({
      responsiblePrepared: 1,
      respectfulWorks: 2,
      effortTeacherScore: 3,
      effortStudentScore: 4,
      daysLateUnprepared: 2, // score 3
    })
    expect(result.calculatedScore).toBe(2.6)
  })
})

describe('calculateApproachToLearning — components in result', () => {
  it('result.components reflects all five inputs', () => {
    const result = calculateApproachToLearning({
      responsiblePrepared: 2,
      respectfulWorks: 3,
      effortTeacherScore: 3,
      effortStudentScore: 4,
      daysLateUnprepared: 3, // score 3
    })
    expect(result.components.responsiblePrepared).toBe(2)
    expect(result.components.respectfulWorks).toBe(3)
    expect(result.components.effortTeacherScore).toBe(3)
    expect(result.components.effortStudentScore).toBe(4)
    expect(result.components.daysLateScore).toBe(3)
  })
})

describe('calculateApproachToLearning — validation', () => {
  it('throws when responsiblePrepared is 0', () => {
    expect(() => calculateApproachToLearning(makeATL({ responsiblePrepared: 0 }))).toThrow()
  })

  it('throws when responsiblePrepared is 5', () => {
    expect(() => calculateApproachToLearning(makeATL({ responsiblePrepared: 5 }))).toThrow()
  })

  it('throws when respectfulWorks is out of range', () => {
    expect(() => calculateApproachToLearning(makeATL({ respectfulWorks: -1 }))).toThrow()
  })

  it('throws when effortTeacherScore is out of range', () => {
    expect(() => calculateApproachToLearning(makeATL({ effortTeacherScore: 10 }))).toThrow()
  })

  it('throws when effortStudentScore is out of range', () => {
    expect(() => calculateApproachToLearning(makeATL({ effortStudentScore: 0 }))).toThrow()
  })

  it('throws when daysLateUnprepared is negative', () => {
    expect(() => calculateApproachToLearning(makeATL({ daysLateUnprepared: -1 }))).toThrow()
  })

  it('throws when daysLateUnprepared is not an integer', () => {
    expect(() => calculateApproachToLearning(makeATL({ daysLateUnprepared: 1.5 }))).toThrow()
  })

  it('accepts valid boundary 1 for teacher-rated fields', () => {
    expect(() => calculateApproachToLearning(makeATL({ responsiblePrepared: 1 }))).not.toThrow()
  })

  it('accepts valid boundary 4 for teacher-rated fields', () => {
    expect(() => calculateApproachToLearning(makeATL({ effortTeacherScore: 4 }))).not.toThrow()
  })
})
