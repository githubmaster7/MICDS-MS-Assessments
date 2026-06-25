/**
 * Tests for MICDS email validation and authentication helpers.
 */

// The actual function from auth lib
function validateMicdsEmail(email: string, allowedDomain = 'micds.org'): boolean {
  if (!email || typeof email !== 'string') return false
  const normalized = email.toLowerCase().trim()
  const parts = normalized.split('@')
  if (parts.length !== 2) return false
  return parts[1] === allowedDomain
}

describe('validateMicdsEmail', () => {
  // Valid cases
  test('valid student email', () => {
    expect(validateMicdsEmail('student@micds.org')).toBe(true)
  })
  test('valid teacher email', () => {
    expect(validateMicdsEmail('teacher.name@micds.org')).toBe(true)
  })
  test('uppercase domain (normalized)', () => {
    expect(validateMicdsEmail('User@MICDS.ORG')).toBe(true)
  })

  // Invalid - wrong domain
  test('gmail rejected', () => {
    expect(validateMicdsEmail('student@gmail.com')).toBe(false)
  })
  test('lookalike domain rejected: micds.org.fake.com', () => {
    expect(validateMicdsEmail('user@micds.org.fake.com')).toBe(false)
  })
  test('lookalike domain rejected: fake.micds.org', () => {
    expect(validateMicdsEmail('user@fake.micds.org')).toBe(false)
  })
  test('subdomain rejected: students.micds.org', () => {
    expect(validateMicdsEmail('user@students.micds.org')).toBe(false)
  })
  test('prefix attack rejected: micds.orgfake@gmail.com', () => {
    expect(validateMicdsEmail('micds.orgfake@gmail.com')).toBe(false)
  })

  // Invalid format
  test('no @ symbol', () => {
    expect(validateMicdsEmail('notanemail')).toBe(false)
  })
  test('multiple @ symbols', () => {
    expect(validateMicdsEmail('a@b@micds.org')).toBe(false)
  })
  test('empty string', () => {
    expect(validateMicdsEmail('')).toBe(false)
  })
  test('null-like input', () => {
    expect(validateMicdsEmail(null as unknown as string)).toBe(false)
  })

  // Custom domain
  test('custom domain configurable', () => {
    expect(validateMicdsEmail('user@school.edu', 'school.edu')).toBe(true)
    expect(validateMicdsEmail('user@micds.org', 'school.edu')).toBe(false)
  })
})

describe('enrollment validation', () => {
  type GradeLevel = 'GRADE_6' | 'GRADE_7' | 'GRADE_8'
  type Gender = 'MALE' | 'FEMALE'

  function canEnrollStudent(
    student: { gradeLevel: GradeLevel; gender: Gender },
    group: { gradeLevel: GradeLevel; gender: 'MALE' | 'FEMALE' }
  ): boolean {
    return student.gradeLevel === group.gradeLevel && student.gender === group.gender
  }

  test('grade 6 boy can enroll in grade 6 boys group', () => {
    expect(canEnrollStudent({ gradeLevel: 'GRADE_6', gender: 'MALE' }, { gradeLevel: 'GRADE_6', gender: 'MALE' })).toBe(true)
  })
  test('grade 6 girl can enroll in grade 6 girls group', () => {
    expect(canEnrollStudent({ gradeLevel: 'GRADE_6', gender: 'FEMALE' }, { gradeLevel: 'GRADE_6', gender: 'FEMALE' })).toBe(true)
  })
  test('grade 7 girl CANNOT enroll in grade 6 girls group', () => {
    expect(canEnrollStudent({ gradeLevel: 'GRADE_7', gender: 'FEMALE' }, { gradeLevel: 'GRADE_6', gender: 'FEMALE' })).toBe(false)
  })
  test('grade 6 girl CANNOT enroll in grade 6 boys group', () => {
    expect(canEnrollStudent({ gradeLevel: 'GRADE_6', gender: 'FEMALE' }, { gradeLevel: 'GRADE_6', gender: 'MALE' })).toBe(false)
  })
  test('grade 8 boy CANNOT enroll in grade 7 girls group', () => {
    expect(canEnrollStudent({ gradeLevel: 'GRADE_8', gender: 'MALE' }, { gradeLevel: 'GRADE_7', gender: 'FEMALE' })).toBe(false)
  })
})
