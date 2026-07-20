/**
 * Server-side enrollment validation.
 *
 * Rules (mirrors the MICDS PE program structure):
 *   - A student's grade level must match the group's grade level exactly.
 *   - A student's gender must match the group's gender exactly.
 *   - No mixed-gender/co-ed groups are permitted — Gender is MALE | FEMALE only.
 *
 * Uses plain string-literal unions (not the Prisma-generated enums) so this
 * module has no runtime dependency on @prisma/client and can be unit tested
 * in isolation.
 */

export type GradeLevel = 'GRADE_6' | 'GRADE_7' | 'GRADE_8'
export type Gender = 'MALE' | 'FEMALE'

export interface EnrollmentStudent {
  gradeLevel: GradeLevel
  gender: Gender
}

export interface EnrollmentGroup {
  gradeLevel: GradeLevel
  gender: Gender
}

export function canEnrollStudent(
  student: EnrollmentStudent,
  group: EnrollmentGroup,
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

export function validateGroupCreation(group: { gender: Gender }): { valid: boolean; reason?: string } {
  if (group.gender !== 'MALE' && group.gender !== 'FEMALE') {
    return { valid: false, reason: 'Group gender must be MALE or FEMALE' }
  }
  return { valid: true }
}
