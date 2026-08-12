import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditAtlRecord, AuditAction } from '@/lib/audit'
import { Role, RotationStatus } from '@prisma/client'
import { z } from 'zod'
import { calculateApproachToLearning } from '@/lib/grading/approach-to-learning'
import { ipRateLimitKey, apiLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ instanceId: string }>
}

const UpdateAtlSelfSchema = z.object({
  effortStudentScore: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
})

// Thrown when the StudentProfile row disappears between the initial lookup
// and the locking transaction (e.g. an admin deletes the account mid-request),
// so it can be told apart from other transaction failures below.
class StudentProfileGoneError extends Error {}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.STUDENT) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { instanceId } = await params

  const studentProfile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!studentProfile) return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 })

  const record = await db.approachToLearningRecord.findUnique({
    where: {
      studentProfileId_historicalClassInstanceId: {
        studentProfileId: studentProfile.id,
        historicalClassInstanceId: instanceId,
      },
    },
    select: {
      responsiblePrepared: true,
      respectfulWorks: true,
      effortStudentScore: true,
      effortTeacherScore: true,
      daysLateUnprepared: true,
      calculatedScore: true,
    },
  })

  return NextResponse.json({ data: record })
}

export async function PUT(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.STUDENT) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const rl = await checkRateLimit(apiLimiter, userRateLimitKey(session.user.id))
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.msBeforeNext / 1000)) } },
    )
  }

  const { instanceId } = await params

  const studentProfile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!studentProfile) return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 })

  const instance = await db.historicalClassInstance.findUnique({
    where: { id: instanceId },
    select: {
      status: true,
      studentGroupId: true,
      teacherClassAssignment: { select: { teacherProfileId: true } },
    },
  })
  if (!instance) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })
  if (instance.status !== RotationStatus.ACTIVE) {
    return NextResponse.json({ error: 'This class instance is not currently active.' }, { status: 409 })
  }

  const membership = await db.studentGroupMembership.findUnique({
    where: {
      studentGroupId_studentProfileId: {
        studentGroupId: instance.studentGroupId,
        studentProfileId: studentProfile.id,
      },
    },
  })
  if (!membership || membership.leftAt) {
    return NextResponse.json({ error: 'You are not in this class.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = UpdateAtlSelfSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { effortStudentScore } = parsed.data
  const ip = ipRateLimitKey(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  // Locks the same parent StudentProfile row the teacher writer locks (see
  // src/app/api/teacher/approach-to-learning/[studentId]/[instanceId]/route.ts),
  // so a concurrent teacher PUT and this student PUT serialize instead of each
  // computing calculatedScore from the other's pre-commit values.
  try {
    const { record, before, calculatedScore } = await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "StudentProfile"
        WHERE id = ${studentProfile.id}::uuid
        FOR UPDATE
      `
      if (locked.length === 0) {
        throw new StudentProfileGoneError()
      }

      const existing = await tx.approachToLearningRecord.findUnique({
        where: {
          studentProfileId_historicalClassInstanceId: {
            studentProfileId: studentProfile.id,
            historicalClassInstanceId: instanceId,
          },
        },
      })

      const beforeValue = existing
        ? {
            effortStudentScore: existing.effortStudentScore?.toNumber() ?? null,
            calculatedScore: existing.calculatedScore?.toNumber() ?? null,
          }
        : null

      const nextResponsiblePrepared = existing?.responsiblePrepared?.toNumber() ?? null
      const nextRespectfulWorks = existing?.respectfulWorks?.toNumber() ?? null
      const nextEffortTeacherScore = existing?.effortTeacherScore?.toNumber() ?? null
      const nextDaysLate = existing?.daysLateUnprepared ?? 0

      let calculatedScoreValue: number | null = null
      if (nextResponsiblePrepared !== null && nextRespectfulWorks !== null && nextEffortTeacherScore !== null) {
        calculatedScoreValue = calculateApproachToLearning({
          responsiblePrepared: nextResponsiblePrepared,
          respectfulWorks: nextRespectfulWorks,
          effortTeacherScore: nextEffortTeacherScore,
          effortStudentScore,
          daysLateUnprepared: nextDaysLate,
        }).calculatedScore
      }

      const savedRecord = await tx.approachToLearningRecord.upsert({
        where: {
          studentProfileId_historicalClassInstanceId: {
            studentProfileId: studentProfile.id,
            historicalClassInstanceId: instanceId,
          },
        },
        create: {
          studentProfileId: studentProfile.id,
          historicalClassInstanceId: instanceId,
          teacherProfileId: instance.teacherClassAssignment.teacherProfileId,
          effortStudentScore,
          calculatedScore: calculatedScoreValue,
        },
        update: {
          effortStudentScore,
          calculatedScore: calculatedScoreValue,
        },
        select: { effortStudentScore: true, effortTeacherScore: true, daysLateUnprepared: true, calculatedScore: true },
      })

      return { record: savedRecord, before: beforeValue, calculatedScore: calculatedScoreValue }
    })

    await auditAtlRecord({
      actorId: session.user.id,
      actorRole: session.user.role,
      studentProfileId: studentProfile.id,
      historicalClassInstanceId: instanceId,
      action: before ? AuditAction.ATL_RECORD_UPDATED : AuditAction.ATL_RECORD_CREATED,
      before,
      after: { effortStudentScore, calculatedScore },
      ipAddress: ip,
      userAgent,
    })

    return NextResponse.json({ data: record })
  } catch (err) {
    if (err instanceof StudentProfileGoneError) {
      return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 })
    }
    console.error('[student/approach-to-learning] Failed to save ATL record:', err)
    return NextResponse.json({ error: 'Something went wrong saving your rating. Please try again.' }, { status: 500 })
  }
}
