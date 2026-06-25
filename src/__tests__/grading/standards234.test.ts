/**
 * Standards 2, 3, 4 — exhaustive threshold tests.
 *
 * Scoring rules:
 *   4   = all green, >50% bright-green
 *   3.5 = all green, >=25% bright-green (a quarter)
 *   3   = >=80% green, no red
 *   2.5 = 70–79% green, no red
 *   2   = 50–69% green  OR  1–3 red
 *   1.5 = 25–49% green  OR  4–5 red
 *   1   = <25% green    OR  >=6 red
 */

import { calculateStandard234, type ItemScore } from '@/lib/grading/standards234'

function it_(scores: (1 | 2 | 3 | 4)[]): ItemScore[] {
  return scores.map((score, i) => ({ itemId: `item-${i}`, score }))
}

function score(scores: (1 | 2 | 3 | 4)[]): number {
  return calculateStandard234(it_(scores)).score
}

// ─── Score 4 ─────────────────────────────────────────────────────────────────

describe('Standards 2/3/4 — score 4 (all green, >50% bright-green)', () => {
  it('all bright-green → 4', () => {
    expect(score([4, 4, 4, 4])).toBe(4)
  })

  it('3/4 bright-green (75%) → 4', () => {
    expect(score([4, 4, 4, 3])).toBe(4)
  })

  it('5/8 bright-green (62.5%) → 4', () => {
    expect(score([4, 4, 4, 4, 4, 3, 3, 3])).toBe(4)
  })

  it('51/100 bright-green → 4', () => {
    const arr: (1 | 2 | 3 | 4)[] = [
      ...Array(51).fill(4),
      ...Array(49).fill(3),
    ]
    expect(score(arr as (1 | 2 | 3 | 4)[])).toBe(4)
  })

  it('all 10 items bright-green → 4', () => {
    expect(score([4, 4, 4, 4, 4, 4, 4, 4, 4, 4])).toBe(4)
  })
})

// ─── Score 3.5 ────────────────────────────────────────────────────────────────

describe('Standards 2/3/4 — score 3.5 (all green, >=25% bright-green)', () => {
  it('all light-green (0% bright) → 3.5', () => {
    // 0% is not >=25%, so per spec this would NOT qualify for 3.5
    // allGreen=true, moreThanHalfBrightGreen=false, atLeastQuarterBrightGreen=false → score 3.5
    // Wait: the code checks allGreen && atLeastQuarterBrightGreen for 3.5
    // 0% bright fails that, so it falls through to 3 check:
    // greenPercent=100 >= 80, redCount=0 → score 3
    const result = calculateStandard234(it_([3, 3, 3, 3]))
    // All green, 0% bright: falls to score 3 (>=80% green, no red)
    expect(result.score).toBe(3)
  })

  it('exactly 25% bright-green (1/4) → 3.5', () => {
    expect(score([4, 3, 3, 3])).toBe(3.5)
  })

  it('exactly 50% bright-green (2/4) → 3.5 (not > 50%)', () => {
    expect(score([4, 4, 3, 3])).toBe(3.5)
  })

  it('2/8 bright-green (25%) → 3.5', () => {
    expect(score([4, 4, 3, 3, 3, 3, 3, 3])).toBe(3.5)
  })

  it('1/4 = 25% bright-green, all green → 3.5', () => {
    expect(score([4, 3, 3, 3])).toBe(3.5)
  })

  it('3/10 bright-green (30%), all green → 3.5', () => {
    expect(score([4, 4, 4, 3, 3, 3, 3, 3, 3, 3])).toBe(3.5)
  })
})

// ─── Score 3 ──────────────────────────────────────────────────────────────────

describe('Standards 2/3/4 — score 3 (>=80% green, no red)', () => {
  it('exactly 80% green (4/5), no red → 3', () => {
    expect(score([3, 3, 3, 3, 2])).toBe(3)
  })

  it('8/10 green (80%), no red → 3', () => {
    expect(score([3, 3, 3, 3, 3, 3, 3, 3, 2, 2])).toBe(3)
  })

  it('9/10 green (90%), no red → 3', () => {
    expect(score([3, 3, 3, 3, 3, 3, 3, 3, 3, 2])).toBe(3)
  })

  it('80/100 green, no red → 3', () => {
    const arr: (1 | 2 | 3 | 4)[] = [
      ...Array(80).fill(3),
      ...Array(20).fill(2),
    ]
    expect(score(arr as (1 | 2 | 3 | 4)[])).toBe(3)
  })

  it('boundary exactly 80% with bright-green mixed in, no red → 3', () => {
    // 3 bright + 5 light = 8 green out of 10, plus 2 yellow
    expect(score([4, 4, 4, 3, 3, 3, 3, 3, 2, 2])).toBe(3)
  })
})

// ─── Score 2.5 ────────────────────────────────────────────────────────────────

describe('Standards 2/3/4 — score 2.5 (70–79% green, no red)', () => {
  it('7/10 green (70%), no red → 2.5', () => {
    expect(score([3, 3, 3, 3, 3, 3, 3, 2, 2, 2])).toBe(2.5)
  })

  it('6/8 green (75%), no red → 2.5', () => {
    expect(score([3, 3, 3, 3, 3, 3, 2, 2])).toBe(2.5)
  })

  it('boundary 79% green, no red → 2.5', () => {
    const arr: (1 | 2 | 3 | 4)[] = [
      ...Array(79).fill(3),
      ...Array(21).fill(2),
    ]
    expect(score(arr as (1 | 2 | 3 | 4)[])).toBe(2.5)
  })

  it('boundary 70% green (7/10), no red → 2.5', () => {
    expect(score([3, 3, 3, 3, 3, 3, 3, 2, 2, 2])).toBe(2.5)
  })

  it('69% green falls below 70% threshold → not 2.5', () => {
    // 69/100 green: falls to score 2 (50-69%)
    const arr: (1 | 2 | 3 | 4)[] = [
      ...Array(69).fill(3),
      ...Array(31).fill(2),
    ]
    expect(score(arr as (1 | 2 | 3 | 4)[])).toBe(2)
  })
})

// ─── Score 2 ──────────────────────────────────────────────────────────────────

describe('Standards 2/3/4 — score 2 (50–69% green OR 1–3 red)', () => {
  it('5/10 green (50%) no red → 2', () => {
    expect(score([3, 3, 3, 3, 3, 2, 2, 2, 2, 2])).toBe(2)
  })

  it('6/10 green (60%) no red → 2', () => {
    expect(score([3, 3, 3, 3, 3, 3, 2, 2, 2, 2])).toBe(2)
  })

  it('boundary 69% green, no red → 2', () => {
    const arr: (1 | 2 | 3 | 4)[] = [
      ...Array(69).fill(3),
      ...Array(31).fill(2),
    ]
    expect(score(arr as (1 | 2 | 3 | 4)[])).toBe(2)
  })

  it('boundary 50% green, no red → 2', () => {
    const arr: (1 | 2 | 3 | 4)[] = [
      ...Array(50).fill(3),
      ...Array(50).fill(2),
    ]
    expect(score(arr as (1 | 2 | 3 | 4)[])).toBe(2)
  })

  it('1 red → 2', () => {
    expect(score([1, 3, 3, 3, 3, 2, 2, 2, 2, 2])).toBe(2)
  })

  it('2 red → 2', () => {
    expect(score([1, 1, 3, 3, 2, 2, 2, 2, 2, 2])).toBe(2)
  })

  it('3 red → 2', () => {
    expect(score([1, 1, 1, 3, 3, 2, 2, 2, 2, 2])).toBe(2)
  })

  it('1 red with mostly yellows → 2', () => {
    expect(score([1, 2, 2, 2, 2, 2, 2])).toBe(2)
  })
})

// ─── Score 1.5 ────────────────────────────────────────────────────────────────

describe('Standards 2/3/4 — score 1.5 (25–49% green OR 4–5 red)', () => {
  it('2/8 green (25%) no red → 1.5', () => {
    expect(score([3, 3, 2, 2, 2, 2, 2, 2])).toBe(1.5)
  })

  it('3/10 green (30%) no red → 1.5', () => {
    expect(score([3, 3, 3, 2, 2, 2, 2, 2, 2, 2])).toBe(1.5)
  })

  it('boundary 49% green no red → 1.5', () => {
    const arr: (1 | 2 | 3 | 4)[] = [
      ...Array(49).fill(3),
      ...Array(51).fill(2),
    ]
    expect(score(arr as (1 | 2 | 3 | 4)[])).toBe(1.5)
  })

  it('boundary 25% green (1/4) no red → 1.5', () => {
    expect(score([3, 2, 2, 2])).toBe(1.5)
  })

  it('4 red → 1.5', () => {
    expect(score([1, 1, 1, 1, 3, 3, 2, 2])).toBe(1.5)
  })

  it('5 red → 1.5', () => {
    expect(score([1, 1, 1, 1, 1, 3, 2, 2])).toBe(1.5)
  })

  it('4 red, no green → 1.5', () => {
    expect(score([1, 1, 1, 1, 2, 2, 2, 2])).toBe(1.5)
  })

  it('5 red in 6 items → 1.5', () => {
    expect(score([1, 1, 1, 1, 1, 2])).toBe(1.5)
  })
})

// ─── Score 1 ──────────────────────────────────────────────────────────────────

describe('Standards 2/3/4 — score 1 (<25% green OR >=6 red)', () => {
  it('0% green (all yellow) → 1', () => {
    expect(score([2, 2, 2, 2, 2, 2])).toBe(1)
  })

  it('1/6 green (17%) no red → 1', () => {
    expect(score([3, 2, 2, 2, 2, 2])).toBe(1)
  })

  it('boundary 24% green no red → 1', () => {
    const arr: (1 | 2 | 3 | 4)[] = [
      ...Array(24).fill(3),
      ...Array(76).fill(2),
    ]
    expect(score(arr as (1 | 2 | 3 | 4)[])).toBe(1)
  })

  it('6 red → 1', () => {
    expect(score([1, 1, 1, 1, 1, 1, 2, 2])).toBe(1)
  })

  it('7 red → 1', () => {
    expect(score([1, 1, 1, 1, 1, 1, 1, 2])).toBe(1)
  })

  it('all red → 1', () => {
    expect(score([1, 1, 1, 1, 1, 1, 1, 1])).toBe(1)
  })

  it('6 red in 6 items → 1', () => {
    expect(score([1, 1, 1, 1, 1, 1])).toBe(1)
  })
})

// ─── Exact boundary transitions ───────────────────────────────────────────────

describe('Standards 2/3/4 — exact boundary transitions', () => {
  it('80% green → 3; 79% green → 2.5', () => {
    // 8/10 = 80%
    expect(score([3, 3, 3, 3, 3, 3, 3, 3, 2, 2])).toBe(3)
    // 79/100 = 79%
    const arr79: (1 | 2 | 3 | 4)[] = [
      ...Array(79).fill(3),
      ...Array(21).fill(2),
    ]
    expect(score(arr79 as (1 | 2 | 3 | 4)[])).toBe(2.5)
  })

  it('70% green → 2.5; 69% green → 2', () => {
    // 7/10 = 70%
    expect(score([3, 3, 3, 3, 3, 3, 3, 2, 2, 2])).toBe(2.5)
    // 69/100 = 69%
    const arr69: (1 | 2 | 3 | 4)[] = [
      ...Array(69).fill(3),
      ...Array(31).fill(2),
    ]
    expect(score(arr69 as (1 | 2 | 3 | 4)[])).toBe(2)
  })

  it('50% green → 2; 49% green → 1.5', () => {
    // 5/10 = 50%
    expect(score([3, 3, 3, 3, 3, 2, 2, 2, 2, 2])).toBe(2)
    // 49/100 = 49%
    const arr49: (1 | 2 | 3 | 4)[] = [
      ...Array(49).fill(3),
      ...Array(51).fill(2),
    ]
    expect(score(arr49 as (1 | 2 | 3 | 4)[])).toBe(1.5)
  })

  it('25% green → 1.5; 24% green → 1', () => {
    // 25/100 = 25%
    const arr25: (1 | 2 | 3 | 4)[] = [
      ...Array(25).fill(3),
      ...Array(75).fill(2),
    ]
    expect(score(arr25 as (1 | 2 | 3 | 4)[])).toBe(1.5)
    // 24/100 = 24%
    const arr24: (1 | 2 | 3 | 4)[] = [
      ...Array(24).fill(3),
      ...Array(76).fill(2),
    ]
    expect(score(arr24 as (1 | 2 | 3 | 4)[])).toBe(1)
  })

  it('3 red → 2; 4 red → 1.5; 5 red → 1.5; 6 red → 1', () => {
    const base = (reds: number) =>
      score([...Array(reds).fill(1), ...Array(10 - reds).fill(2)] as (1 | 2 | 3 | 4)[])
    expect(base(3)).toBe(2)
    expect(base(4)).toBe(1.5)
    expect(base(5)).toBe(1.5)
    expect(base(6)).toBe(1)
  })

  it('50% bright-green boundary: exactly 50% (2/4) → 3.5, not 4', () => {
    expect(score([4, 4, 3, 3])).toBe(3.5)
  })

  it('just over 50% bright-green (3/5 = 60%) → 4', () => {
    expect(score([4, 4, 4, 3, 3])).toBe(4)
  })

  it('exactly 25% bright-green (1/4) → 3.5', () => {
    expect(score([4, 3, 3, 3])).toBe(3.5)
  })

  it('just under 25% bright-green (1/5 = 20%), all green → falls to 3', () => {
    // allGreen=true, moreThanHalfBright=false, atLeastQuarterBright=false (1/5=20%<25%)
    // → falls to greenPercent>=80 check: 100% green, no red → score 3
    expect(score([4, 3, 3, 3, 3])).toBe(3)
  })
})

// ─── Result object ────────────────────────────────────────────────────────────

describe('Standards 2/3/4 — result object fields', () => {
  it('returns correct breakdown counts', () => {
    const result = calculateStandard234(it_([4, 4, 3, 2, 1, 1]))
    expect(result.totalItems).toBe(6)
    expect(result.breakdown.brightGreen).toBe(2)
    expect(result.breakdown.lightGreen).toBe(1)
    expect(result.breakdown.yellow).toBe(1)
    expect(result.breakdown.red).toBe(2)
    expect(result.greenCount).toBe(3)
    expect(result.brightGreenCount).toBe(2)
    expect(result.redCount).toBe(2)
  })

  it('throws on empty items array', () => {
    expect(() => calculateStandard234([])).toThrow()
  })
})
