import { calculateStandardScore, type StandardScoreItem } from '@/lib/grading/standard-score'

function items(scores: (1 | 2 | 3 | 4)[]): StandardScoreItem[] {
  return scores.map((score) => ({ score }))
}

function score(scores: (1 | 2 | 3 | 4)[]): number {
  return calculateStandardScore(items(scores)).score
}

describe('calculateStandardScore — rule 1: missing / 6+ deficiencies / <=20%', () => {
  it('empty item list (missing submission) → 1', () => {
    const result = calculateStandardScore([])
    expect(result.score).toBe(1)
    expect(result.totalItems).toBe(0)
    expect(result.greenPercent).toBe(0)
  })

  it('6 major deficiencies (reds) → 1, regardless of the rest', () => {
    // 6 red + 4 bright-green would otherwise be 40% green, but 6 reds floor it.
    expect(score([1, 1, 1, 1, 1, 1, 4, 4, 4, 4])).toBe(1)
  })

  it('7+ reds still → 1', () => {
    expect(score([1, 1, 1, 1, 1, 1, 1, 4, 4])).toBe(1)
  })

  it('0% green, 0 red (all yellow) → 1', () => {
    expect(score([2, 2, 2, 2])).toBe(1)
  })

  it('exactly 20% green, 0 red → 1', () => {
    expect(score([3, 2, 2, 2, 2])).toBe(1)
  })
})

describe('calculateStandardScore — rule 2: 4-5 deficiencies / 21-29%', () => {
  it('4 reds → 1.5', () => {
    expect(score([1, 1, 1, 1, 3, 3])).toBe(1.5)
  })

  it('5 reds → 1.5', () => {
    expect(score([1, 1, 1, 1, 1, 3, 3, 3])).toBe(1.5)
  })

  it('~21% green, 0 red → 1.5', () => {
    // 3/14 ≈ 21.4%
    const arr = [...Array(3).fill(3), ...Array(11).fill(2)] as (1 | 2 | 3 | 4)[]
    expect(score(arr)).toBe(1.5)
  })

  it('29% green, 0 red → 1.5', () => {
    // 29/100
    const arr = [...Array(29).fill(3), ...Array(71).fill(2)] as (1 | 2 | 3 | 4)[]
    expect(score(arr)).toBe(1.5)
  })
})

describe('calculateStandardScore — rule 3: 1-3 deficiencies / 30-39%', () => {
  it('1 red → 2, even with otherwise-strong performance', () => {
    // 1 red + 9 bright-green = 90% green, but 1 deficiency caps it at 2.
    expect(score([1, 4, 4, 4, 4, 4, 4, 4, 4, 4])).toBe(2)
  })

  it('3 reds → 2', () => {
    expect(score([1, 1, 1, 3, 3, 3, 3])).toBe(2)
  })

  it('30% green, 0 red → 2', () => {
    const arr = [...Array(30).fill(3), ...Array(70).fill(2)] as (1 | 2 | 3 | 4)[]
    expect(score(arr)).toBe(2)
  })

  it('39% green, 0 red → 2', () => {
    const arr = [...Array(39).fill(3), ...Array(61).fill(2)] as (1 | 2 | 3 | 4)[]
    expect(score(arr)).toBe(2)
  })
})

describe('calculateStandardScore — rule 4: 40-49% green, 0 red', () => {
  it('40% green → 2.5', () => {
    const arr = [...Array(40).fill(3), ...Array(60).fill(2)] as (1 | 2 | 3 | 4)[]
    expect(score(arr)).toBe(2.5)
  })

  it('49% green → 2.5', () => {
    const arr = [...Array(49).fill(3), ...Array(51).fill(2)] as (1 | 2 | 3 | 4)[]
    expect(score(arr)).toBe(2.5)
  })
})

describe('calculateStandardScore — rule 5: 50-74% green, 0 red', () => {
  it('50% green → 3 (inclusive lower bound)', () => {
    expect(score([3, 3, 3, 2, 2, 2])).toBe(3)
  })

  it('74% green → 3', () => {
    const arr = [...Array(74).fill(3), ...Array(26).fill(2)] as (1 | 2 | 3 | 4)[]
    expect(score(arr)).toBe(3)
  })

  it('all light-green (100%, but not majority bright) still caps at 3 if <75%... ', () => {
    // sanity: 60% green with a mix, 0 red
    const arr = [...Array(60).fill(4), ...Array(40).fill(2)] as (1 | 2 | 3 | 4)[]
    expect(score(arr)).toBe(3)
  })
})

describe('calculateStandardScore — rule 6: Exceeding benchmark (>=75%, all green, >half bright) → 4', () => {
  it('all bright-green → 4', () => {
    expect(score([4, 4, 4, 4])).toBe(4)
  })

  it('all green, more than half bright-green → 4', () => {
    expect(score([4, 4, 4, 3])).toBe(4) // 100% green, 75% bright (>50%)
  })

  it('all green, exactly half bright-green → NOT 4 (falls to 3.5)', () => {
    expect(score([4, 4, 4, 3, 3, 3])).toBe(3.5) // 100% green, 50% bright (not >50%)
  })
})

describe('calculateStandardScore — rule 7: default 3.5 (>=75% performance, Exceeding not met)', () => {
  it('75% green, 0 red, not all-green → 3.5 (not capped at 3 anymore)', () => {
    const arr = [...Array(75).fill(3), ...Array(25).fill(2)] as (1 | 2 | 3 | 4)[]
    expect(score(arr)).toBe(3.5)
  })

  it('100% green but no bright-green at all → 3.5', () => {
    expect(score([3, 3, 3, 3])).toBe(3.5)
  })

  it('all green, less than half bright-green → 3.5', () => {
    expect(score([4, 3, 3, 3])).toBe(3.5) // 25% bright, not >50%
  })
})

describe('calculateStandardScore — evaluation order / priority', () => {
  it('a single major deficiency outranks an otherwise-Exceeding performance', () => {
    // 1 red + 8 bright-green: would be "all green, >half bright" if the red
    // were excluded, but the red item is real and must cap the score at 2.
    expect(score([1, 4, 4, 4, 4, 4, 4, 4, 4])).toBe(2)
  })

  it('6 reds outrank everything, even 94% bright-green among the rest', () => {
    expect(score([1, 1, 1, 1, 1, 1, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4])).toBe(1)
  })
})

describe('calculateStandardScore — result shape', () => {
  it('reports correct breakdown counts and greenPercent', () => {
    const result = calculateStandardScore(items([1, 2, 3, 4]))
    expect(result.totalItems).toBe(4)
    expect(result.breakdown).toEqual({ red: 1, yellow: 1, lightGreen: 1, brightGreen: 1 })
    expect(result.redCount).toBe(1)
    expect(result.greenCount).toBe(2)
    expect(result.brightGreenCount).toBe(1)
    expect(result.greenPercent).toBeCloseTo(50, 5)
  })
})
