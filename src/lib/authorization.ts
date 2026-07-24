/**
 * Server-side authorization helpers.
 *
 * All functions perform DB lookups via the shared Prisma client and throw
 * (or return false) when the check fails.  Callers should invoke these
 * inside server actions or API route handlers after the session has been
 * verified by NextAuth.
 *
 * Convention:
 *   - "can*" functions return a boolean and never throw.
 *   - "require*" functions throw a 403-style Error when the check fails.
 *   - "is*"  functions return a boolean and never throw.
 */

import { db } from '@/lib/db'
import { Role, RotationStatus } from '@prisma/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function forbidden(message: string): never {
  const err = new Error(message)
  ;(err as Error & { statusCode: number }).statusCode = 403
  throw err
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true if the actor is allowed to view data for a given student.
 *
 * Rules:
 *   ADMIN   – always allowed
 *   TEACHER – allowed if they are currently assigned to the student's group
 *   STUDENT – only allowed for their own profile
 *   PARENT  – allowed if there is a verified ParentStudentLink
 */
export async function canViewStudent(
  actorId: string,
  actorRole: Role,
  studentProfileId: string
): Promise<boolean> {
  if (actorRole === Role.ADMIN) return true

  if (actorRole === Role.STUDENT) {
    const profile = await db.studentProfile.findUnique({
      where: { userId: actorId },
      select: { id: true },
    })
    return profile?.id === studentProfileId
  }

  if (actorRole === Role.PARENT) {
    const parentProfile = await db.parentProfile.findUnique({
      where: { userId: actorId },
      select: { id: true },
    })
    if (!parentProfile) return false

    const link = await db.parentStudentLink.findUnique({
      where: {
        parentProfileId_studentProfileId: {
          parentProfileId: parentProfile.id,
          studentProfileId,
        },
      },
      select: { id: true },
    })
    return link !== null
  }

  if (actorRole === Role.TEACHER) {
    const teacherProfile = await db.teacherProfile.findUnique({
      where: { userId: actorId },
      select: { id: true },
    })
    if (!teacherProfile) return false

    return isTeacherCurrentlyAssigned(teacherProfile.id, studentProfileId)
  }

  return false
}

/**
 * Returns true if the teacher is currently assigned (via an active
 * GroupRotationAssignment → CarouselPosition → TeacherClassAssignment chain)
 * to the student group that contains the given student.
 */
async function isTeacherCurrentlyAssigned(
  teacherProfileId: string,
  studentProfileId: string
): Promise<boolean> {
  // Find the student's current active group membership
  const memberships = await db.studentGroupMembership.findMany({
    where: {
      studentProfileId,
      leftAt: null,
    },
    select: { studentGroupId: true },
  })

  if (memberships.length === 0) return false

  const studentGroupIds = memberships.map((m: { studentGroupId: string }) => m.studentGroupId)

  // Check if the teacher has an active rotation assignment to any of those groups
  const assignment = await db.groupRotationAssignment.findFirst({
    where: {
      studentGroupId: { in: studentGroupIds },
      status: { in: [RotationStatus.ACTIVE, RotationStatus.UPCOMING] },
      carouselPosition: {
        teacherClassAssignment: {
          teacherProfileId,
          isActive: true,
        },
      },
    },
    select: { id: true },
  })

  return assignment !== null
}

/**
 * Returns true if the given teacher is currently assigned to the class
 * instance identified by `classInstanceId`.
 *
 * A teacher "can grade" a class instance when:
 *   - Their TeacherClassAssignment matches the instance's teacherClassAssignmentId
 *   - The class instance is currently ACTIVE
 *
 * Once a class instance locks (on rotation), grading is permanently closed —
 * there is no override, admin or otherwise.
 */
export async function canTeacherGrade(
  teacherId: string,
  classInstanceId: string
): Promise<boolean> {
  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: teacherId },
    select: { id: true },
  })
  if (!teacherProfile) return false

  const instance = await db.historicalClassInstance.findUnique({
    where: { id: classInstanceId },
    select: {
      status: true,
      teacherClassAssignment: {
        select: { teacherProfileId: true, isActive: true },
      },
    },
  })

  if (!instance) return false
  // Teachers may only grade the class instance that is their CURRENT,
  // active rotation — never a future (UPCOMING) one, and never a LOCKED one.
  if (instance.status !== RotationStatus.ACTIVE) return false
  if (!instance.teacherClassAssignment.isActive) return false
  return instance.teacherClassAssignment.teacherProfileId === teacherProfile.id
}

/**
 * Returns true if the class instance has been locked (status LOCKED or
 * lockedAt is set).
 */
export async function isClassInstanceLocked(classInstanceId: string): Promise<boolean> {
  const instance = await db.historicalClassInstance.findUnique({
    where: { id: classInstanceId },
    select: { status: true, lockedAt: true },
  })

  if (!instance) {
    throw new Error(`isClassInstanceLocked: class instance "${classInstanceId}" not found`)
  }

  return instance.status === RotationStatus.LOCKED || instance.lockedAt !== null
}

/**
 * Returns true if the teacher (by teacherProfileId, not userId) is currently
 * assigned to the student group via an active GroupRotationAssignment.
 */
export async function isTeacherCurrentlyAssignedToGroup(
  teacherProfileId: string,
  studentGroupId: string
): Promise<boolean> {
  const assignment = await db.groupRotationAssignment.findFirst({
    where: {
      studentGroupId,
      status: { in: [RotationStatus.ACTIVE, RotationStatus.UPCOMING] },
      carouselPosition: {
        teacherClassAssignment: {
          teacherProfileId,
          isActive: true,
        },
      },
    },
    select: { id: true },
  })

  return assignment !== null
}

/**
 * Throws a 403 error if the actor (a student) is not the owner of the given
 * student profile.
 */
export async function requireStudentOwnership(
  actorId: string,
  studentProfileId: string
): Promise<void> {
  const profile = await db.studentProfile.findUnique({
    where: { userId: actorId },
    select: { id: true },
  })

  if (!profile || profile.id !== studentProfileId) {
    forbidden('You do not have permission to access this student profile.')
  }
}

/**
 * Throws a 403 error if there is no verified ParentStudentLink between the
 * parent and the given student profile.
 */
export async function requireParentStudentLink(
  parentId: string,
  studentProfileId: string
): Promise<void> {
  const parentProfile = await db.parentProfile.findUnique({
    where: { userId: parentId },
    select: { id: true },
  })

  if (!parentProfile) {
    forbidden('Parent profile not found.')
  }

  const link = await db.parentStudentLink.findUnique({
    where: {
      parentProfileId_studentProfileId: {
        parentProfileId: parentProfile.id,
        studentProfileId,
      },
    },
    select: { id: true },
  })

  if (!link) {
    forbidden('You are not authorized to view data for this student.')
  }
}
