/**
 * Enrollment validation tests.
 *
 * Rules:
 *   - Student grade level must match the group's grade level.
 *   - Student gender must match the group's gender.
 *   - A "mixed gender" group is not permitted.
 *   - Grade mismatch is rejected.
 *
 * Exercises the real implementation in src/lib/enrollment.ts — the same
 * function the student-group membership API route calls server-side.
 */

import { canEnrollStudent, validateGroupCreation, canAssignActivityToGroup, type Gender, type GradeLevel } from '@/lib/enrollment'

// ─── Grade level tests ────────────────────────────────────────────────────────

describe('enrollment — grade level matching', () => {
  it('grade 6 boy can enroll in grade 6 boys group', () => {
    const result = canEnrollStudent(
      { gradeLevel: 'GRADE_6', gender: 'MALE' },
      { gradeLevel: 'GRADE_6', gender: 'MALE' }
    )
    expect(result.allowed).toBe(true)
  })

  it('grade 7 girl can enroll in grade 7 girls group', () => {
    const result = canEnrollStudent(
      { gradeLevel: 'GRADE_7', gender: 'FEMALE' },
      { gradeLevel: 'GRADE_7', gender: 'FEMALE' }
    )
    expect(result.allowed).toBe(true)
  })

  it('grade 8 boy can enroll in grade 8 boys group', () => {
    const result = canEnrollStudent(
      { gradeLevel: 'GRADE_8', gender: 'MALE' },
      { gradeLevel: 'GRADE_8', gender: 'MALE' }
    )
    expect(result.allowed).toBe(true)
  })

  it('grade 7 girl CANNOT enroll in grade 6 girls group (grade mismatch)', () => {
    const result = canEnrollStudent(
      { gradeLevel: 'GRADE_7', gender: 'FEMALE' },
      { gradeLevel: 'GRADE_6', gender: 'FEMALE' }
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/grade/i)
  })

  it('grade 6 girl CANNOT enroll in grade 7 girls group', () => {
    const result = canEnrollStudent(
      { gradeLevel: 'GRADE_6', gender: 'FEMALE' },
      { gradeLevel: 'GRADE_7', gender: 'FEMALE' }
    )
    expect(result.allowed).toBe(false)
  })

  it('grade 8 boy CANNOT enroll in grade 6 boys group', () => {
    const result = canEnrollStudent(
      { gradeLevel: 'GRADE_8', gender: 'MALE' },
      { gradeLevel: 'GRADE_6', gender: 'MALE' }
    )
    expect(result.allowed).toBe(false)
  })

  it('grade 6 student CANNOT enroll in grade 8 group', () => {
    const result = canEnrollStudent(
      { gradeLevel: 'GRADE_6', gender: 'FEMALE' },
      { gradeLevel: 'GRADE_8', gender: 'FEMALE' }
    )
    expect(result.allowed).toBe(false)
  })
})

// ─── Gender matching tests ────────────────────────────────────────────────────

describe('enrollment — gender matching', () => {
  it('grade 6 girl CANNOT enroll in grade 6 boys group', () => {
    const result = canEnrollStudent(
      { gradeLevel: 'GRADE_6', gender: 'FEMALE' },
      { gradeLevel: 'GRADE_6', gender: 'MALE' }
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/gender/i)
  })

  it('grade 7 boy CANNOT enroll in grade 7 girls group', () => {
    const result = canEnrollStudent(
      { gradeLevel: 'GRADE_7', gender: 'MALE' },
      { gradeLevel: 'GRADE_7', gender: 'FEMALE' }
    )
    expect(result.allowed).toBe(false)
  })

  it('grade 8 girl CANNOT enroll in grade 8 boys group', () => {
    const result = canEnrollStudent(
      { gradeLevel: 'GRADE_8', gender: 'FEMALE' },
      { gradeLevel: 'GRADE_8', gender: 'MALE' }
    )
    expect(result.allowed).toBe(false)
  })
})

// ─── Both mismatches ──────────────────────────────────────────────────────────

describe('enrollment — grade AND gender mismatch', () => {
  it('grade 8 boy CANNOT enroll in grade 7 girls group (both mismatch)', () => {
    const result = canEnrollStudent(
      { gradeLevel: 'GRADE_8', gender: 'MALE' },
      { gradeLevel: 'GRADE_7', gender: 'FEMALE' }
    )
    expect(result.allowed).toBe(false)
  })

  it('reason message references grade when grade differs (grade checked first)', () => {
    const result = canEnrollStudent(
      { gradeLevel: 'GRADE_6', gender: 'MALE' },
      { gradeLevel: 'GRADE_7', gender: 'FEMALE' }
    )
    expect(result.allowed).toBe(false)
    // Grade is checked first per implementation order
    expect(result.reason).toMatch(/grade/i)
  })
})

// ─── Group creation validation ────────────────────────────────────────────────

describe('group creation — gender constraint', () => {
  it('MALE group is valid', () => {
    expect(validateGroupCreation({ gender: 'MALE' }).valid).toBe(true)
  })

  it('FEMALE group is valid', () => {
    expect(validateGroupCreation({ gender: 'FEMALE' }).valid).toBe(true)
  })

  it('MIXED gender group creation is rejected', () => {
    // Cast to bypass TypeScript — simulates a runtime API payload
    const result = validateGroupCreation({ gender: 'MIXED' as Gender })
    expect(result.valid).toBe(false)
  })

  it('empty string gender is rejected', () => {
    const result = validateGroupCreation({ gender: '' as Gender })
    expect(result.valid).toBe(false)
  })

  it('undefined gender is rejected', () => {
    const result = validateGroupCreation({ gender: undefined as unknown as Gender })
    expect(result.valid).toBe(false)
  })
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('enrollment — edge cases', () => {
  it('all three grade levels work correctly for matching', () => {
    const grades: GradeLevel[] = ['GRADE_6', 'GRADE_7', 'GRADE_8']
    for (const grade of grades) {
      const result = canEnrollStudent(
        { gradeLevel: grade, gender: 'MALE' },
        { gradeLevel: grade, gender: 'MALE' }
      )
      expect(result.allowed).toBe(true)
    }
  })

  it('cross-grade rejections are symmetric', () => {
    // If 6→7 is rejected, 7→6 is also rejected
    const a = canEnrollStudent(
      { gradeLevel: 'GRADE_6', gender: 'MALE' },
      { gradeLevel: 'GRADE_7', gender: 'MALE' }
    )
    const b = canEnrollStudent(
      { gradeLevel: 'GRADE_7', gender: 'MALE' },
      { gradeLevel: 'GRADE_6', gender: 'MALE' }
    )
    expect(a.allowed).toBe(false)
    expect(b.allowed).toBe(false)
  })
})

// ─── Class-to-group carousel assignment ──────────────────────────────────────

describe('canAssignActivityToGroup — matching class to group', () => {
  it('class explicitly for GRADE_6/MALE fits a GRADE_6/MALE group', () => {
    const result = canAssignActivityToGroup(
      { gradeLevel: 'GRADE_6', gender: 'MALE' },
      { gradeLevel: 'GRADE_6', gender: 'MALE' }
    )
    expect(result.allowed).toBe(true)
  })

  it('class explicitly for GRADE_7/FEMALE does NOT fit a GRADE_6/FEMALE group (grade mismatch)', () => {
    const result = canAssignActivityToGroup(
      { gradeLevel: 'GRADE_7', gender: 'FEMALE' },
      { gradeLevel: 'GRADE_6', gender: 'FEMALE' }
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/grade/i)
  })

  it('class explicitly for GRADE_8/MALE does NOT fit a GRADE_8/FEMALE group (gender mismatch)', () => {
    const result = canAssignActivityToGroup(
      { gradeLevel: 'GRADE_8', gender: 'MALE' },
      { gradeLevel: 'GRADE_8', gender: 'FEMALE' }
    )
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/gender/i)
  })

  it('class with null gradeLevel and null gender fits any group (generic class)', () => {
    const result = canAssignActivityToGroup(
      { gradeLevel: null, gender: null },
      { gradeLevel: 'GRADE_7', gender: 'FEMALE' }
    )
    expect(result.allowed).toBe(true)
  })

  it('class with null gradeLevel but explicit gender only checks gender', () => {
    const matching = canAssignActivityToGroup(
      { gradeLevel: null, gender: 'MALE' },
      { gradeLevel: 'GRADE_5', gender: 'MALE' }
    )
    const mismatched = canAssignActivityToGroup(
      { gradeLevel: null, gender: 'MALE' },
      { gradeLevel: 'GRADE_5', gender: 'FEMALE' }
    )
    expect(matching.allowed).toBe(true)
    expect(mismatched.allowed).toBe(false)
  })

  it('class with null gender but explicit gradeLevel only checks grade', () => {
    const matching = canAssignActivityToGroup(
      { gradeLevel: 'GRADE_8', gender: null },
      { gradeLevel: 'GRADE_8', gender: 'FEMALE' }
    )
    const mismatched = canAssignActivityToGroup(
      { gradeLevel: 'GRADE_8', gender: null },
      { gradeLevel: 'GRADE_6', gender: 'FEMALE' }
    )
    expect(matching.allowed).toBe(true)
    expect(mismatched.allowed).toBe(false)
  })
})
