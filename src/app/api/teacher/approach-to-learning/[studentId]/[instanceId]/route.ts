import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditAtlRecord, AuditAction } from '@/lib/audit'
import { canTeacherGrade } from '@/lib/authorization'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { calculateApproachToLearning } from '@/lib/grading/approach-to-learning'
import { ipRateLimitKey, apiLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ studentId: string; instanceId: string }>
}

const UpdateAtlSchema = z.object({
  responsiblePrepared: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  respectfulWorks: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  effortTeacherScore: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  daysLateUnprepared: z.number().int().min(0).optional(),
})

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.TEACHER) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { studentId, instanceId } = await params

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!teacherProfile) return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 404 })

  const instance = await db.historicalClassInstance.findUnique({
    where: { id: instanceId },
    select: { teacherClassAssignment: { select: { teacherProfileId: true } } },
  })
  if (!instance) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })
  if (instance.teacherClassAssignment.teacherProfileId !== teacherProfile.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const record = await db.approachToLearningRecord.findUnique({
    where: {
      studentProfileId_historicalClassInstanceId: {
        studentProfileId: studentId,
        historicalClassInstanceId: instanceId,
      },
    },
  })

  return NextResponse.json({ data: record })
}

export async function PUT(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.TEACHER) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const rl = await checkRateLimit(apiLimiter, userRateLimitKey(session.user.id))
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.msBeforeNext / 1000)) } },
    )
  }

  const { studentId, instanceId } = await params

  const canGrade = await canTeacherGrade(session.user.id, instanceId, studentId)
  if (!canGrade) {
    return NextResponse.json(
      { error: 'You are not authorized to update this student in this class instance, or it is locked.' },
      { status: 403 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = UpdateAtlSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { responsiblePrepared, respectfulWorks, effortTeacherScore, daysLateUnprepared } = parsed.data
  if (
    responsiblePrepared === undefined &&
    respectfulWorks === undefined &&
    effortTeacherScore === undefined &&
    daysLateUnprepared === undefined
  ) {
    return NextResponse.json({ error: 'Provide at least one field to update.' }, { status: 400 })
  }

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!teacherProfile) return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 500 })

  const ip = ipRateLimitKey(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  // The read-then-write below (read "existing", merge in the incoming
  // field(s), compute calculatedScore from that merge, upsert) is a classic
  // read-modify-write race: two near-simultaneous PUTs updating different
  // fields (e.g. one setting responsiblePrepared, another setting
  // respectfulWorks moments later) can each read the same pre-update row and
  // compute calculatedScore from a stale merge, silently leaving a
  // subsequently-out-of-date derived score. `SELECT ... FOR UPDATE` inside a
  // transaction locks the row so a second concurrent PUT blocks until the
  // first commits, then reads the first PUT's result rather than a stale one.
  const { record, before, nextResponsiblePrepared, nextRespectfulWorks, nextEffortTeacherScore, nextDaysLate, calculatedScore } =
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "ApproachToLearningRecord"
        WHERE "studentProfileId" = ${studentId}::uuid
          AND "historicalClassInstanceId" = ${instanceId}::uuid
        FOR UPDATE
      `

      const existing = await tx.approachToLearningRecord.findUnique({
        where: {
          studentProfileId_historicalClassInstanceId: {
            studentProfileId: studentId,
            historicalClassInstanceId: instanceId,
          },
        },
      })

      const beforeValue = existing
        ? {
            responsiblePrepared: existing.responsiblePrepared?.toNumber() ?? null,
            respectfulWorks: existing.respectfulWorks?.toNumber() ?? null,
            effortTeacherScore: existing.effortTeacherScore?.toNumber() ?? null,
            daysLateUnprepared: existing.daysLateUnprepared,
            calculatedScore: existing.calculatedScore?.toNumber() ?? null,
          }
        : null

      const responsiblePreparedValue = responsiblePrepared ?? existing?.responsiblePrepared?.toNumber() ?? null
      const respectfulWorksValue = respectfulWorks ?? existing?.respectfulWorks?.toNumber() ?? null
      const effortTeacherScoreValue = effortTeacherScore ?? existing?.effortTeacherScore?.toNumber() ?? null
      const effortStudentScoreValue = existing?.effortStudentScore?.toNumber() ?? null
      const daysLateValue = daysLateUnprepared ?? existing?.daysLateUnprepared ?? 0

      let calculatedScoreValue: number | null = null
      if (
        responsiblePreparedValue !== null &&
        respectfulWorksValue !== null &&
        effortTeacherScoreValue !== null &&
        effortStudentScoreValue !== null
      ) {
        calculatedScoreValue = calculateApproachToLearning({
          responsiblePrepared: responsiblePreparedValue,
          respectfulWorks: respectfulWorksValue,
          effortTeacherScore: effortTeacherScoreValue,
          effortStudentScore: effortStudentScoreValue,
          daysLateUnprepared: daysLateValue,
        }).calculatedScore
      }

      const savedRecord = await tx.approachToLearningRecord.upsert({
        where: {
          studentProfileId_historicalClassInstanceId: {
            studentProfileId: studentId,
            historicalClassInstanceId: instanceId,
          },
        },
        create: {
          studentProfileId: studentId,
          historicalClassInstanceId: instanceId,
          teacherProfileId: teacherProfile.id,
          responsiblePrepared: responsiblePreparedValue,
          respectfulWorks: respectfulWorksValue,
          effortTeacherScore: effortTeacherScoreValue,
          daysLateUnprepared: daysLateValue,
          calculatedScore: calculatedScoreValue,
        },
        update: {
          ...(responsiblePrepared !== undefined ? { responsiblePrepared } : {}),
          ...(respectfulWorks !== undefined ? { respectfulWorks } : {}),
          ...(effortTeacherScore !== undefined ? { effortTeacherScore } : {}),
          ...(daysLateUnprepared !== undefined ? { daysLateUnprepared } : {}),
          calculatedScore: calculatedScoreValue,
        },
      })

      return {
        record: savedRecord,
        before: beforeValue,
        nextResponsiblePrepared: responsiblePreparedValue,
        nextRespectfulWorks: respectfulWorksValue,
        nextEffortTeacherScore: effortTeacherScoreValue,
        nextDaysLate: daysLateValue,
        calculatedScore: calculatedScoreValue,
      }
    })

  await auditAtlRecord({
    actorId: session.user.id,
    actorRole: session.user.role,
    studentProfileId: studentId,
    historicalClassInstanceId: instanceId,
    action: before ? AuditAction.ATL_RECORD_UPDATED : AuditAction.ATL_RECORD_CREATED,
    before,
    after: {
      responsiblePrepared: nextResponsiblePrepared,
      respectfulWorks: nextRespectfulWorks,
      effortTeacherScore: nextEffortTeacherScore,
      daysLateUnprepared: nextDaysLate,
      calculatedScore,
    },
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({ data: record })
}
