import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role, RotationStatus, SubmissionStatus } from '@prisma/client'
import { apiLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

const MAX_RESULTS = 500

/**
 * Read-only, cross-group class oversight for admins — every scheduled class
 * instance (current, past, and upcoming) across every student group and
 * teacher, for the "All Classes" / global class snapshot workspace.
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
  const status = searchParams.get('status')
  const groupId = searchParams.get('groupId')
  const teacherProfileId = searchParams.get('teacherProfileId')
  const schoolYearId = searchParams.get('schoolYearId')

  const where: Record<string, unknown> = {}
  if (status && Object.values(RotationStatus).includes(status as RotationStatus)) {
    where.status = status
  }
  if (groupId) where.studentGroupId = groupId
  if (schoolYearId) where.schoolYearId = schoolYearId
  if (teacherProfileId) {
    where.teacherClassAssignment = { teacherProfileId }
  }

  const instances = await db.historicalClassInstance.findMany({
    where,
    take: MAX_RESULTS,
    orderBy: [{ groupRotationAssignment: { rotationNumber: 'asc' } }, { studentGroup: { name: 'asc' } }],
    select: {
      id: true,
      status: true,
      lockedAt: true,
      studentGroup: { select: { id: true, name: true, gradeLevel: true, gender: true } },
      teacherClassAssignment: {
        select: {
          activityTemplate: { select: { id: true, name: true } },
          teacherProfile: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      groupRotationAssignment: {
        select: { rotationNumber: true, startDate: true, endDate: true, status: true },
      },
      _count: { select: { teacherAssessments: true } },
    },
  })

  const truncated = instances.length === MAX_RESULTS
  const instanceIds = instances.map((ci) => ci.id)

  // Submissions have one row per (student, standard) and snapshots grow
  // unbounded across recalculations, so a raw _count would wildly overstate
  // per-student progress — count distinct students per instance instead.
  const [submittedRows, gradedRows] = await Promise.all([
    db.studentSubmission.groupBy({
      by: ['historicalClassInstanceId', 'studentProfileId'],
      where: {
        historicalClassInstanceId: { in: instanceIds },
        status: { in: [SubmissionStatus.SUBMITTED, SubmissionStatus.REASSESSMENT_SUBMITTED] },
      },
    }),
    db.gradeCalculationSnapshot.groupBy({
      by: ['historicalClassInstanceId', 'studentProfileId'],
      where: { historicalClassInstanceId: { in: instanceIds } },
    }),
  ])

  const submittedCountByInstance = new Map<string, number>()
  for (const row of submittedRows) {
    submittedCountByInstance.set(
      row.historicalClassInstanceId,
      (submittedCountByInstance.get(row.historicalClassInstanceId) ?? 0) + 1,
    )
  }
  const gradedCountByInstance = new Map<string, number>()
  for (const row of gradedRows) {
    gradedCountByInstance.set(
      row.historicalClassInstanceId,
      (gradedCountByInstance.get(row.historicalClassInstanceId) ?? 0) + 1,
    )
  }

  const rows = instances.map((ci) => ({
    id: ci.id,
    status: ci.status,
    lockedAt: ci.lockedAt,
    group: ci.studentGroup,
    activity: ci.teacherClassAssignment.activityTemplate,
    teacher: ci.teacherClassAssignment.teacherProfile,
    rotationNumber: ci.groupRotationAssignment.rotationNumber,
    startDate: ci.groupRotationAssignment.startDate,
    endDate: ci.groupRotationAssignment.endDate,
    submissionCount: submittedCountByInstance.get(ci.id) ?? 0,
    assessmentCount: ci._count.teacherAssessments,
    snapshotCount: gradedCountByInstance.get(ci.id) ?? 0,
  }))

  return NextResponse.json({ data: rows, truncated, maxResults: MAX_RESULTS })
}
