import { countWordChanges, isRevised } from '@/lib/grading/resubmission'

describe('countWordChanges', () => {
  it('returns 0 for identical text', () => {
    expect(countWordChanges('The quick brown fox', 'The quick brown fox')).toBe(0)
  })

  it('returns 0 for whitespace-only differences', () => {
    expect(countWordChanges('The quick brown fox', '  The   quick brown   fox  ')).toBe(0)
  })

  it('returns 0 for two empty strings', () => {
    expect(countWordChanges('', '')).toBe(0)
  })

  it('counts a pure addition', () => {
    // "fox jumps" appended — 2 words added, 0 removed
    expect(countWordChanges('The quick brown', 'The quick brown fox jumps')).toBe(2)
  })

  it('counts a pure removal', () => {
    expect(countWordChanges('The quick brown fox jumps', 'The quick brown')).toBe(2)
  })

  it('counts a single word edit as a remove+add (cost 2)', () => {
    expect(countWordChanges('The quick brown fox', 'The slow brown fox')).toBe(2)
  })

  it('counts multiple word edits', () => {
    // "quick"->"slow", "fox"->"cat": 2 edits = 4 changed words
    expect(countWordChanges('The quick brown fox jumps', 'The slow brown cat jumps')).toBe(4)
  })

  it('treats a fully rewritten sentence as all words changed', () => {
    const oldText = 'Improving strength helps your bones'
    const newText = 'Playing wrestling builds your cardio'
    // LCS is just "your" (1 word shared)
    expect(countWordChanges(oldText, newText)).toBe((5 - 1) + (5 - 1))
  })

  it('handles one side empty (new answer written from scratch)', () => {
    expect(countWordChanges('', 'This is a brand new answer')).toBe(6)
  })

  it('handles one side empty (answer cleared out)', () => {
    expect(countWordChanges('This is a brand new answer', '')).toBe(6)
  })
})

describe('isRevised', () => {
  it('is false when nothing changed', () => {
    expect(isRevised('same text here', 'same text here')).toBe(false)
  })

  it('is true for even a single word changed', () => {
    expect(isRevised('one two three four five', 'one two three four six')).toBe(true)
  })

  it('is true for a single word removed', () => {
    expect(isRevised('one two three four five', 'one two three four')).toBe(true)
  })

  it('is true for a substantially rewritten answer', () => {
    const oldText = 'Strength training makes your muscles stronger.'
    const newText =
      'Improving strength also helps your posture and balance, which lowers your risk of injury both in sports and in everyday movements like lifting or catching yourself if you trip.'
    expect(isRevised(oldText, newText)).toBe(true)
  })

  it('is false for a trivial punctuation/whitespace tweak', () => {
    expect(isRevised('Hello world', 'Hello   world')).toBe(false)
  })
})
