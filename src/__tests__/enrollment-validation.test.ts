/**
 * Enrollment validation tests.
 *
 * Rules:
 *   - Student grade level must match the group's grade level.
 *   - Student gender must match the group's gender.
 *   - A "mixed gender" group is not permitted.
 *   - Grade mismatch is rejected.
 */

// ─── Types mirroring the domain model ────────────────────────────────────────

type GradeLevel = 'GRADE_6' | 'GRADE_7' | 'GRADE_8'
type Gender = 'MALE' | 'FEMALE'

interface StudentProfile {
  gradeLevel: GradeLevel
  gender: Gender
}

interface StudentGroup {
  gradeLevel: GradeLevel
  gender: Gender
}

// ─── Enrollment rule implementation (inline for test isolation) ───────────────
//
// This mirrors what the API routes / server actions enforce.  The logic is
// simple enough that keeping it here avoids a DB dependency and lets the tests
// describe the rules precisely.

function canEnrollStudent(
  student: StudentProfile,
  group: StudentGroup
): { allowed: boolean; reason?: string } {
  if (student.gradeLevel !== group.gradeLevel) {
    return {
      allowed: false,
      reason: `Grade mismatch: student is ${student.gradeLevel} but group is ${group.gradeLevel}`,
    }
  }
  if (student.gender !== group.gender) {
    return {
      allowed: false,
      reason: `Gender mismatch: student is ${student.gender} but group is ${group.gender}`,
    }
  }
  return { allowed: true }
}

function validateGroupCreation(group: { gender: Gender }): { valid: boolean; reason?: string } {
  // Groups must have a single defined gender — no 'MIXED' value is allowed in this domain.
  // The Gender type already enforces MALE | FEMALE so this tests the runtime guard.
  if (group.gender !== 'MALE' && group.gender !== 'FEMALE') {
    return { valid: false, reason: 'Group gender must be MALE or FEMALE' }
  }
  return { valid: true }
}

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
