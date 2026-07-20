import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role, RotationStatus, GradeLevel, Gender } from '@prisma/client'
import { apiLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

const MAX_RESULTS = 500

/**
 * Read-only, cross-group student oversight for admins.
 *
 * Unlike the teacher roster (scoped to one currently-assigned group), this
 * returns every active student in the school with their current group/class
 * and latest grade snapshot, for admin-only "all students" reporting.
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

  const { searchParams } = req.nextUrl
  const gradeLevelParam = searchParams.get('gradeLevel')
  const genderParam = searchParams.get('gender')
  const groupId = searchParams.get('groupId')
  const search = searchParams.get('search')?.trim()
  const letterGrade = searchParams.get('letterGrade')
  const minAverage = searchParams.get('minAverage')
  const maxAverage = searchParams.get('maxAverage')

  const where: Record<string, unknown> = {}
  if (gradeLevelParam && Object.values(GradeLevel).includes(gradeLevelParam as GradeLevel)) {
    where.gradeLevel = gradeLevelParam
  }
  if (genderParam && Object.values(Gender).includes(genderParam as Gender)) {
    where.gender = genderParam
  }
  if (groupId) {
    where.groupMemberships = { some: { studentGroupId: groupId, leftAt: null } }
  }
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { studentId: { contains: search, mode: 'insensitive' } },
    ]
  }

  const students = await db.studentProfile.findMany({
    where,
    take: MAX_RESULTS,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gradeLevel: true,
      gender: true,
      studentId: true,
      groupMemberships: {
        where: { leftAt: null },
        select: {
          studentGroup: {
            select: {
              id: true,
              name: true,
              groupRotationAssignments: {
                where: { status: RotationStatus.ACTIVE },
                take: 1,
                select: {
                  carouselPosition: {
                    select: {
                      teacherClassAssignment: {
                        select: {
                          activityTemplate: { select: { name: true } },
                          teacherProfile: { select: { firstName: true, lastName: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  const truncated = students.length === MAX_RESULTS

  // Latest grade snapshot per student — one extra query, no N+1.
  const snapshots = await db.gradeCalculationSnapshot.findMany({
    where: { studentProfileId: { in: students.map((s) => s.id) } },
    orderBy: { calculatedAt: 'desc' },
    select: {
      studentProfileId: true,
      standard1Score: true,
      standard2Score: true,
      standard3Score: true,
      standard4Score: true,
      overallAverage: true,
      letterGrade: true,
      calculatedAt: true,
    },
  })
  const latestSnapshotByStudent = new Map<string, (typeof snapshots)[number]>()
  for (const snap of snapshots) {
    if (!latestSnapshotByStudent.has(snap.studentProfileId)) {
      latestSnapshotByStudent.set(snap.studentProfileId, snap)
    }
  }

  const min = minAverage ? Number(minAverage) : null
  const max = maxAverage ? Number(maxAverage) : null

  const rows = students
    .map((s) => {
      const membership = s.groupMemberships[0]
      const rotation = membership?.studentGroup.groupRotationAssignments[0]
      const tca = rotation?.carouselPosition.teacherClassAssignment
      const snapshot = latestSnapshotByStudent.get(s.id) ?? null

      return {
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        gradeLevel: s.gradeLevel,
        gender: s.gender,
        studentId: s.studentId,
        currentGroup: membership ? { id: membership.studentGroup.id, name: membership.studentGroup.name } : null,
        currentActivity: tca?.activityTemplate.name ?? null,
        currentTeacher: tca?.teacherProfile ? `${tca.teacherProfile.firstName} ${tca.teacherProfile.lastName}` : null,
        overallAverage: snapshot?.overallAverage ?? null,
        letterGrade: snapshot?.letterGrade ?? null,
        standard1Score: snapshot?.standard1Score ?? null,
        standard2Score: snapshot?.standard2Score ?? null,
        standard3Score: snapshot?.standard3Score ?? null,
        standard4Score: snapshot?.standard4Score ?? null,
        hasGrade: snapshot !== null,
      }
    })
    .filter((row) => {
      if (letterGrade && row.letterGrade !== letterGrade) return false
      if (min !== null && (row.overallAverage === null || Number(row.overallAverage) < min)) return false
      if (max !== null && (row.overallAverage === null || Number(row.overallAverage) > max)) return false
      return true
    })

  return NextResponse.json({ data: rows, truncated, maxResults: MAX_RESULTS })
}
