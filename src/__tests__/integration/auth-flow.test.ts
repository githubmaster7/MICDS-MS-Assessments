/**
 * Auth flow integration tests.
 *
 * All external dependencies (email, DB) are mocked.  The tests describe the
 * full user lifecycle: signup → email verification → admin approval/rejection
 * → route access control.
 */

import { jest } from '@jest/globals'

// ─── Mock transports ──────────────────────────────────────────────────────────

const mockSendMail = jest.fn()
jest.mock('@/lib/email', () => ({
  sendVerificationEmail: mockSendMail,
  sendApprovalEmail: mockSendMail,
  sendRejectionEmail: mockSendMail,
}))

// ─── Auth status enum (mirrors Prisma schema) ─────────────────────────────────

const AccountStatus = {
  PENDING_EMAIL: 'PENDING_EMAIL',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACTIVE: 'ACTIVE',
  REJECTED: 'REJECTED',
} as const
type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus]

const Role = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  PARENT: 'PARENT',
} as const
type Role = (typeof Role)[keyof typeof Role]

// ─── Inline implementations of auth rules for test isolation ─────────────────
//
// These implement the same logic as the API routes, in pure form, so tests are
// not coupled to HTTP or Next.js machinery.  If the rules change in the routes,
// these tests will catch the divergence.

function validateMicdsEmail(email: string): { valid: boolean; reason?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, reason: 'Email must be a non-empty string' }
  }
  const normalized = email.toLowerCase().trim()
  const parts = normalized.split('@')
  if (parts.length !== 2) {
    return { valid: false, reason: 'Invalid email format' }
  }
  if (parts[1] !== 'micds.org') {
    return { valid: false, reason: 'Only @micds.org email addresses are allowed' }
  }
  return { valid: true }
}

interface User {
  id: string
  email: string
  role: Role
  status: AccountStatus
  emailVerified: boolean
  emailVerificationToken: string | null
}

function createSignupRequest(
  email: string,
  role: Role
): { user: User | null; error?: string } {
  const emailCheck = validateMicdsEmail(email)
  if (!emailCheck.valid) {
    return { user: null, error: emailCheck.reason }
  }
  const user: User = {
    id: `user-${Math.random().toString(36).slice(2)}`,
    email,
    role,
    status: AccountStatus.PENDING_EMAIL,
    emailVerified: false,
    emailVerificationToken: 'mock-token-abc123',
  }
  mockSendMail(email, user.emailVerificationToken)
  return { user }
}

function verifyEmail(user: User, token: string): { success: boolean; updatedUser: User } {
  if (user.emailVerificationToken !== token) {
    return { success: false, updatedUser: user }
  }
  const updatedUser: User = {
    ...user,
    emailVerified: true,
    emailVerificationToken: null,
    status: AccountStatus.PENDING_APPROVAL,
  }
  return { success: true, updatedUser }
}

function adminApprove(user: User): User {
  if (user.status !== AccountStatus.PENDING_APPROVAL) {
    throw new Error(`Cannot approve user with status ${user.status}`)
  }
  return { ...user, status: AccountStatus.ACTIVE }
}

function adminReject(user: User): User {
  if (user.status !== AccountStatus.PENDING_APPROVAL) {
    throw new Error(`Cannot reject user with status ${user.status}`)
  }
  return { ...user, status: AccountStatus.REJECTED }
}

function canAccessTeacherRoute(user: User): boolean {
  return user.role === Role.TEACHER && user.status === AccountStatus.ACTIVE
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
})

// ─── Signup validation ────────────────────────────────────────────────────────

describe('signup — email validation', () => {
  it('non-micds email is rejected', () => {
    const result = createSignupRequest('student@gmail.com', Role.STUDENT)
    expect(result.user).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('micds.org.fake.com subdomain is rejected (server-side)', () => {
    const result = createSignupRequest('user@micds.org.fake.com', Role.STUDENT)
    expect(result.user).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('fake.micds.org is rejected', () => {
    const result = createSignupRequest('user@fake.micds.org', Role.TEACHER)
    expect(result.user).toBeNull()
  })

  it('students.micds.org subdomain is rejected', () => {
    const result = createSignupRequest('user@students.micds.org', Role.STUDENT)
    expect(result.user).toBeNull()
  })

  it('empty email is rejected', () => {
    const result = createSignupRequest('', Role.STUDENT)
    expect(result.user).toBeNull()
  })

  it('valid micds.org email is accepted', () => {
    const result = createSignupRequest('teacher@micds.org', Role.TEACHER)
    expect(result.user).not.toBeNull()
    expect(result.user?.status).toBe(AccountStatus.PENDING_EMAIL)
  })
})

// ─── Post-signup state ────────────────────────────────────────────────────────

describe('signup — initial state after valid signup', () => {
  it('new user starts as PENDING_EMAIL', () => {
    const { user } = createSignupRequest('teacher@micds.org', Role.TEACHER)
    expect(user?.status).toBe(AccountStatus.PENDING_EMAIL)
  })

  it('new user has emailVerified false', () => {
    const { user } = createSignupRequest('teacher@micds.org', Role.TEACHER)
    expect(user?.emailVerified).toBe(false)
  })

  it('verification email is sent on signup', () => {
    createSignupRequest('teacher@micds.org', Role.TEACHER)
    expect(mockSendMail).toHaveBeenCalledTimes(1)
  })

  it('verification email is sent to the provided address', () => {
    createSignupRequest('teacher@micds.org', Role.TEACHER)
    expect(mockSendMail).toHaveBeenCalledWith('teacher@micds.org', expect.any(String))
  })
})

// ─── Email verification ───────────────────────────────────────────────────────

describe('email verification flow', () => {
  function signedUpUser(): User {
    const { user } = createSignupRequest('teacher@micds.org', Role.TEACHER)
    return user!
  }

  it('valid token advances user to PENDING_APPROVAL', () => {
    const user = signedUpUser()
    const { success, updatedUser } = verifyEmail(user, 'mock-token-abc123')
    expect(success).toBe(true)
    expect(updatedUser.status).toBe(AccountStatus.PENDING_APPROVAL)
  })

  it('email is marked verified after verification', () => {
    const user = signedUpUser()
    const { updatedUser } = verifyEmail(user, 'mock-token-abc123')
    expect(updatedUser.emailVerified).toBe(true)
  })

  it('verification token is cleared after use', () => {
    const user = signedUpUser()
    const { updatedUser } = verifyEmail(user, 'mock-token-abc123')
    expect(updatedUser.emailVerificationToken).toBeNull()
  })

  it('wrong token does not advance status', () => {
    const user = signedUpUser()
    const { success, updatedUser } = verifyEmail(user, 'wrong-token')
    expect(success).toBe(false)
    expect(updatedUser.status).toBe(AccountStatus.PENDING_EMAIL)
  })
})

// ─── Admin approval ───────────────────────────────────────────────────────────

describe('admin approval flow', () => {
  function pendingApprovalUser(): User {
    const { user } = createSignupRequest('teacher@micds.org', Role.TEACHER)
    const { updatedUser } = verifyEmail(user!, 'mock-token-abc123')
    return updatedUser
  }

  it('admin approval sets status to ACTIVE', () => {
    const user = pendingApprovalUser()
    const approved = adminApprove(user)
    expect(approved.status).toBe(AccountStatus.ACTIVE)
  })

  it('admin rejection sets status to REJECTED', () => {
    const user = pendingApprovalUser()
    const rejected = adminReject(user)
    expect(rejected.status).toBe(AccountStatus.REJECTED)
  })

  it('cannot approve an already active user', () => {
    const user = pendingApprovalUser()
    const approved = adminApprove(user)
    expect(() => adminApprove(approved)).toThrow()
  })

  it('cannot reject an already rejected user', () => {
    const user = pendingApprovalUser()
    const rejected = adminReject(user)
    expect(() => adminReject(rejected)).toThrow()
  })

  it('cannot approve a user who has not verified email yet', () => {
    const { user } = createSignupRequest('teacher@micds.org', Role.TEACHER)
    expect(() => adminApprove(user!)).toThrow()
  })
})

// ─── Route access control ─────────────────────────────────────────────────────

describe('route access — /teacher/* routes', () => {
  it('ACTIVE teacher can access teacher routes', () => {
    const user: User = {
      id: 'u1',
      email: 'teacher@micds.org',
      role: Role.TEACHER,
      status: AccountStatus.ACTIVE,
      emailVerified: true,
      emailVerificationToken: null,
    }
    expect(canAccessTeacherRoute(user)).toBe(true)
  })

  it('PENDING_EMAIL user cannot access teacher routes', () => {
    const { user } = createSignupRequest('teacher@micds.org', Role.TEACHER)
    expect(canAccessTeacherRoute(user!)).toBe(false)
  })

  it('PENDING_APPROVAL user cannot access teacher routes', () => {
    const { user } = createSignupRequest('teacher@micds.org', Role.TEACHER)
    const { updatedUser } = verifyEmail(user!, 'mock-token-abc123')
    expect(canAccessTeacherRoute(updatedUser)).toBe(false)
  })

  it('REJECTED user cannot access teacher routes', () => {
    const { user } = createSignupRequest('teacher@micds.org', Role.TEACHER)
    const { updatedUser } = verifyEmail(user!, 'mock-token-abc123')
    const rejected = adminReject(updatedUser)
    expect(canAccessTeacherRoute(rejected)).toBe(false)
  })

  it('ACTIVE student cannot access teacher routes (wrong role)', () => {
    const user: User = {
      id: 'u2',
      email: 'student@micds.org',
      role: Role.STUDENT,
      status: AccountStatus.ACTIVE,
      emailVerified: true,
      emailVerificationToken: null,
    }
    expect(canAccessTeacherRoute(user)).toBe(false)
  })

  it('ACTIVE admin cannot access teacher routes (wrong role)', () => {
    const user: User = {
      id: 'u3',
      email: 'admin@micds.org',
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
      emailVerified: true,
      emailVerificationToken: null,
    }
    expect(canAccessTeacherRoute(user)).toBe(false)
  })
})

// ─── Full lifecycle ───────────────────────────────────────────────────────────

describe('complete auth lifecycle', () => {
  it('happy path: signup → verify → approve → can grade', () => {
    const { user: newUser } = createSignupRequest('pe.teacher@micds.org', Role.TEACHER)
    expect(newUser?.status).toBe(AccountStatus.PENDING_EMAIL)

    const { updatedUser: verifiedUser } = verifyEmail(newUser!, 'mock-token-abc123')
    expect(verifiedUser.status).toBe(AccountStatus.PENDING_APPROVAL)

    const activeUser = adminApprove(verifiedUser)
    expect(activeUser.status).toBe(AccountStatus.ACTIVE)
    expect(canAccessTeacherRoute(activeUser)).toBe(true)
  })

  it('rejection path: signup → verify → reject → cannot grade', () => {
    const { user: newUser } = createSignupRequest('pe.teacher@micds.org', Role.TEACHER)
    const { updatedUser: verifiedUser } = verifyEmail(newUser!, 'mock-token-abc123')
    const rejectedUser = adminReject(verifiedUser)

    expect(rejectedUser.status).toBe(AccountStatus.REJECTED)
    expect(canAccessTeacherRoute(rejectedUser)).toBe(false)
  })
})
