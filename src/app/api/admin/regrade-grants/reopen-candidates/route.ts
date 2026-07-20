import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role, RotationStatus } from '@prisma/client'
import { apiLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

/**
 * One row per active StudentGroup that has a locked class instance eligible
 * for reopening — its most-recently-locked instance, that instance's
 * teacher, and the group's current roster. Feeds the three independent
 * Groups/Teachers/Students selectors on the bulk reopen page: Teachers and
 * Students are derived client-side from whichever groups are checked, since
 * every candidate here already carries its own teacher + student list.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.ADMIN) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const rl = await checkRateLimit(apiLimiter, userRateLimitKey(session.user.id))
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.msBeforeNext / 1000)) } },
    )
  }

  const groups = await db.studentGroup.findMany({ where: { isActive: true }, select: { id: true, name: true } })

  const candidates = await Promise.all(
    groups.map(async (group) => {
      const instance = await db.historicalClassInstance.findFirst({
        where: { studentGroupId: group.id, status: RotationStatus.LOCKED },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          lockedAt: true,
          groupRotationAssignment: { select: { rotationNumber: true } },
          teacherClassAssignment: {
            select: {
              activityTemplate: { select: { name: true } },
              teacherProfile: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      })
      if (!instance) return null

      const members = await db.studentGroupMembership.findMany({
        where: { studentGroupId: group.id, leftAt: null },
        select: { studentProfile: { select: { id: true, firstName: true, lastName: true } } },
      })

      return {
        groupId: group.id,
        groupName: group.name,
        instanceId: instance.id,
        rotationNumber: instance.groupRotationAssignment.rotationNumber,
        activityName: instance.teacherClassAssignment.activityTemplate.name,
        lockedAt: instance.lockedAt,
        teacher: {
          id: instance.teacherClassAssignment.teacherProfile.id,
          name: `${instance.teacherClassAssignment.teacherProfile.firstName} ${instance.teacherClassAssignment.teacherProfile.lastName}`,
        },
        students: members.map((m) => ({
          id: m.studentProfile.id,
          name: `${m.studentProfile.firstName} ${m.studentProfile.lastName}`,
        })),
      }
    }),
  )

  return NextResponse.json({ data: candidates.filter((c): c is NonNullable<typeof c> => c !== null) })
}
