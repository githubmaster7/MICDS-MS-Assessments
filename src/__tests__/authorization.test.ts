/**
 * Authorization helper tests.
 *
 * The authorization module calls Prisma directly.  We mock the db module so
 * no real database is required.
 */

// ─── Mocks must be declared before imports so jest hoisting works correctly ───

jest.mock('@/lib/db', () => {
  const mockDb = {
    studentProfile: { findUnique: jest.fn() },
    parentProfile: { findUnique: jest.fn() },
    parentStudentLink: { findUnique: jest.fn() },
    teacherProfile: { findUnique: jest.fn() },
    studentGroupMembership: { findMany: jest.fn(), findUnique: jest.fn() },
    groupRotationAssignment: { findFirst: jest.fn() },
    historicalClassInstance: { findUnique: jest.fn() },
  }
  return { db: mockDb }
})

// Import AFTER the mock declaration (hoisting ensures mock is applied first)
import {
  canViewStudent,
  canTeacherGrade,
  isClassInstanceLocked,
  requireStudentOwnership,
} from '@/lib/authorization'

import { db } from '@/lib/db'

// Typed reference to the mocked db — every method is a jest.fn()
const mockDb = db as unknown as {
  studentProfile: { findUnique: jest.Mock }
  parentProfile: { findUnique: jest.Mock }
  parentStudentLink: { findUnique: jest.Mock }
  teacherProfile: { findUnique: jest.Mock }
  studentGroupMembership: { findMany: jest.Mock; findUnique: jest.Mock }
  groupRotationAssignment: { findFirst: jest.Mock }
  historicalClassInstance: { findUnique: jest.Mock }
}

// Prisma enums — mirror the values from the stub / @prisma/client
const Role = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  PARENT: 'PARENT',
} as const

const RotationStatus = {
  ACTIVE: 'ACTIVE',
  UPCOMING: 'UPCOMING',
  LOCKED: 'LOCKED',
  COMPLETED: 'COMPLETED',
} as const

// ─── Reset mocks before each test ─────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── canViewStudent ───────────────────────────────────────────────────────────

describe('canViewStudent — ADMIN', () => {
  it('admin can view any student without DB lookup', async () => {
    const result = await canViewStudent('admin-user-id', Role.ADMIN as any, 'any-student-id')
    expect(result).toBe(true)
    expect(mockDb.studentProfile.findUnique).not.toHaveBeenCalled()
  })
})

describe('canViewStudent — STUDENT', () => {
  it('student can view their own profile', async () => {
    mockDb.studentProfile.findUnique.mockResolvedValueOnce({ id: 'student-profile-1' })
    const result = await canViewStudent('user-1', Role.STUDENT as any, 'student-profile-1')
    expect(result).toBe(true)
  })

  it('student cannot view another student profile', async () => {
    mockDb.studentProfile.findUnique.mockResolvedValueOnce({ id: 'student-profile-1' })
    const result = await canViewStudent('user-1', Role.STUDENT as any, 'student-profile-OTHER')
    expect(result).toBe(false)
  })

  it('student with no profile returns false', async () => {
    mockDb.studentProfile.findUnique.mockResolvedValueOnce(null)
    const result = await canViewStudent('user-ghost', Role.STUDENT as any, 'any-profile')
    expect(result).toBe(false)
  })
})

describe('canViewStudent — PARENT', () => {
  it('parent can view linked student', async () => {
    mockDb.parentProfile.findUnique.mockResolvedValueOnce({ id: 'parent-profile-1' })
    mockDb.parentStudentLink.findUnique.mockResolvedValueOnce({ id: 'link-1' })
    const result = await canViewStudent('parent-user-1', Role.PARENT as any, 'student-profile-1')
    expect(result).toBe(true)
  })

  it('parent cannot view unlinked student', async () => {
    mockDb.parentProfile.findUnique.mockResolvedValueOnce({ id: 'parent-profile-1' })
    mockDb.parentStudentLink.findUnique.mockResolvedValueOnce(null)
    const result = await canViewStudent('parent-user-1', Role.PARENT as any, 'student-profile-OTHER')
    expect(result).toBe(false)
  })

  it('parent with no profile returns false', async () => {
    mockDb.parentProfile.findUnique.mockResolvedValueOnce(null)
    const result = await canViewStudent('parent-ghost', Role.PARENT as any, 'student-profile-1')
    expect(result).toBe(false)
  })

  it('parent link lookup uses correct composite key', async () => {
    mockDb.parentProfile.findUnique.mockResolvedValueOnce({ id: 'pp-1' })
    mockDb.parentStudentLink.findUnique.mockResolvedValueOnce({ id: 'link-1' })
    await canViewStudent('parent-user-1', Role.PARENT as any, 'sp-1')

    expect(mockDb.parentStudentLink.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          parentProfileId_studentProfileId: {
            parentProfileId: 'pp-1',
            studentProfileId: 'sp-1',
          },
        },
      })
    )
  })
})

describe('canViewStudent — TEACHER', () => {
  it('teacher can view student in their assigned group', async () => {
    mockDb.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'teacher-profile-1' })
    mockDb.studentGroupMembership.findMany.mockResolvedValueOnce([
      { studentGroupId: 'group-1' },
    ])
    mockDb.groupRotationAssignment.findFirst.mockResolvedValueOnce({ id: 'gra-1' })
    const result = await canViewStudent('teacher-user-1', Role.TEACHER as any, 'student-profile-1')
    expect(result).toBe(true)
  })

  it('teacher cannot view student not in their group', async () => {
    mockDb.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'teacher-profile-1' })
    mockDb.studentGroupMembership.findMany.mockResolvedValueOnce([
      { studentGroupId: 'group-1' },
    ])
    mockDb.groupRotationAssignment.findFirst.mockResolvedValueOnce(null)
    const result = await canViewStudent('teacher-user-1', Role.TEACHER as any, 'student-profile-1')
    expect(result).toBe(false)
  })

  it('teacher with no profile returns false', async () => {
    mockDb.teacherProfile.findUnique.mockResolvedValueOnce(null)
    const result = await canViewStudent('teacher-ghost', Role.TEACHER as any, 'student-profile-1')
    expect(result).toBe(false)
  })

  it('teacher returns false when student has no active group membership', async () => {
    mockDb.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'teacher-profile-1' })
    mockDb.studentGroupMembership.findMany.mockResolvedValueOnce([])
    const result = await canViewStudent('teacher-user-1', Role.TEACHER as any, 'student-profile-1')
    expect(result).toBe(false)
  })
})

// ─── canTeacherGrade ──────────────────────────────────────────────────────────

describe('canTeacherGrade', () => {
  it('teacher can grade a student enrolled in their own active, unlocked instance', async () => {
    mockDb.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' })
    mockDb.historicalClassInstance.findUnique.mockResolvedValueOnce({
      status: RotationStatus.ACTIVE,
      studentGroupId: 'group-1',
      teacherClassAssignment: { teacherProfileId: 'tp-1', isActive: true },
    })
    mockDb.studentGroupMembership.findUnique.mockResolvedValueOnce({ id: 'membership-1' })
    const result = await canTeacherGrade('teacher-user-1', 'instance-1', 'sp-1')
    expect(result).toBe(true)
  })

  it('SECURITY: teacher cannot grade a student not enrolled in that instance\'s group, even though they own the instance', async () => {
    mockDb.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' })
    mockDb.historicalClassInstance.findUnique.mockResolvedValueOnce({
      status: RotationStatus.ACTIVE,
      studentGroupId: 'group-1',
      teacherClassAssignment: { teacherProfileId: 'tp-1', isActive: true },
    })
    mockDb.studentGroupMembership.findUnique.mockResolvedValueOnce(null)
    const result = await canTeacherGrade('teacher-user-1', 'instance-1', 'sp-NOT-ENROLLED')
    expect(result).toBe(false)
    expect(mockDb.studentGroupMembership.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentGroupId_studentProfileId: {
            studentGroupId: 'group-1',
            studentProfileId: 'sp-NOT-ENROLLED',
          },
        },
      })
    )
  })

  it('teacher cannot grade a locked instance — locking is permanent, no override', async () => {
    mockDb.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' })
    mockDb.historicalClassInstance.findUnique.mockResolvedValueOnce({
      status: RotationStatus.LOCKED,
      studentGroupId: 'group-1',
      teacherClassAssignment: { teacherProfileId: 'tp-1', isActive: true },
    })
    const result = await canTeacherGrade('teacher-user-1', 'instance-1', 'sp-1')
    expect(result).toBe(false)
    // Should short-circuit on lock status before even checking membership.
    expect(mockDb.studentGroupMembership.findUnique).not.toHaveBeenCalled()
  })

  it('teacher cannot grade an instance assigned to another teacher', async () => {
    mockDb.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' })
    mockDb.historicalClassInstance.findUnique.mockResolvedValueOnce({
      status: RotationStatus.ACTIVE,
      studentGroupId: 'group-1',
      teacherClassAssignment: { teacherProfileId: 'tp-OTHER', isActive: true },
    })
    const result = await canTeacherGrade('teacher-user-1', 'instance-1', 'sp-1')
    expect(result).toBe(false)
  })

  it('teacher cannot grade when their class assignment is inactive', async () => {
    mockDb.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' })
    mockDb.historicalClassInstance.findUnique.mockResolvedValueOnce({
      status: RotationStatus.ACTIVE,
      studentGroupId: 'group-1',
      teacherClassAssignment: { teacherProfileId: 'tp-1', isActive: false },
    })
    const result = await canTeacherGrade('teacher-user-1', 'instance-1', 'sp-1')
    expect(result).toBe(false)
  })

  it('returns false when teacher profile not found', async () => {
    mockDb.teacherProfile.findUnique.mockResolvedValueOnce(null)
    const result = await canTeacherGrade('teacher-ghost', 'instance-1', 'sp-1')
    expect(result).toBe(false)
  })

  it('returns false when class instance not found', async () => {
    mockDb.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' })
    mockDb.historicalClassInstance.findUnique.mockResolvedValueOnce(null)
    const result = await canTeacherGrade('teacher-user-1', 'nonexistent-instance', 'sp-1')
    expect(result).toBe(false)
  })
})

// ─── isClassInstanceLocked ────────────────────────────────────────────────────

describe('isClassInstanceLocked', () => {
  it('returns true when status is LOCKED', async () => {
    mockDb.historicalClassInstance.findUnique.mockResolvedValueOnce({
      status: RotationStatus.LOCKED,
      lockedAt: null,
    })
    const result = await isClassInstanceLocked('instance-1')
    expect(result).toBe(true)
  })

  it('returns true when lockedAt is set (even if status differs)', async () => {
    mockDb.historicalClassInstance.findUnique.mockResolvedValueOnce({
      status: RotationStatus.ACTIVE,
      lockedAt: new Date(),
    })
    const result = await isClassInstanceLocked('instance-1')
    expect(result).toBe(true)
  })

  it('returns false when status is ACTIVE and lockedAt is null', async () => {
    mockDb.historicalClassInstance.findUnique.mockResolvedValueOnce({
      status: RotationStatus.ACTIVE,
      lockedAt: null,
    })
    const result = await isClassInstanceLocked('instance-1')
    expect(result).toBe(false)
  })

  it('throws when class instance not found', async () => {
    mockDb.historicalClassInstance.findUnique.mockResolvedValueOnce(null)
    await expect(isClassInstanceLocked('nonexistent-instance')).rejects.toThrow()
  })
})

// ─── requireStudentOwnership ──────────────────────────────────────────────────

describe('requireStudentOwnership', () => {
  it('resolves without throwing when actor owns the profile', async () => {
    mockDb.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-1' })
    await expect(requireStudentOwnership('user-1', 'sp-1')).resolves.toBeUndefined()
  })

  it('throws when actor does not own the profile', async () => {
    mockDb.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-1' })
    await expect(requireStudentOwnership('user-1', 'sp-OTHER')).rejects.toThrow()
  })

  it('throws when actor has no student profile', async () => {
    mockDb.studentProfile.findUnique.mockResolvedValueOnce(null)
    await expect(requireStudentOwnership('user-ghost', 'sp-1')).rejects.toThrow()
  })

  it('thrown error carries statusCode 403', async () => {
    mockDb.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-1' })
    let caught: any = null
    try {
      await requireStudentOwnership('user-1', 'sp-OTHER')
    } catch (e) {
      caught = e
    }
    expect(caught).not.toBeNull()
    expect((caught as any).statusCode).toBe(403)
  })
})
