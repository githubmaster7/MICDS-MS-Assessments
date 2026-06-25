/**
 * Prisma stub for Jest.  Prevents the generated Prisma client from being
 * loaded during unit tests.  Individual test files mock '@/lib/db' directly
 * to inject their own mock implementations.
 */

export class PrismaClient {
  // No-op constructor
}

export const Role = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  PARENT: 'PARENT',
} as const

export const RotationStatus = {
  ACTIVE: 'ACTIVE',
  UPCOMING: 'UPCOMING',
  LOCKED: 'LOCKED',
  COMPLETED: 'COMPLETED',
} as const
