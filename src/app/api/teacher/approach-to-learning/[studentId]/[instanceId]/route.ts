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

  const canGrade = await canTeacherGrade(session.user.id, instanceId)
  if (!canGrade) {
    return NextResponse.json(
      { error: 'You are not authorized to update this class instance, or it is locked.' },
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

  const existing = await db.approachToLearningRecord.findUnique({
    where: {
      studentProfileId_historicalClassInstanceId: {
        studentProfileId: studentId,
        historicalClassInstanceId: instanceId,
      },
    },
  })

  const before = existing
    ? {
        responsiblePrepared: existing.responsiblePrepared?.toNumber() ?? null,
        respectfulWorks: existing.respectfulWorks?.toNumber() ?? null,
        effortTeacherScore: existing.effortTeacherScore?.toNumber() ?? null,
        daysLateUnprepared: existing.daysLateUnprepared,
        calculatedScore: existing.calculatedScore?.toNumber() ?? null,
      }
    : null

  const nextResponsiblePrepared = responsiblePrepared ?? existing?.responsiblePrepared?.toNumber() ?? null
  const nextRespectfulWorks = respectfulWorks ?? existing?.respectfulWorks?.toNumber() ?? null
  const nextEffortTeacherScore = effortTeacherScore ?? existing?.effortTeacherScore?.toNumber() ?? null
  const nextEffortStudentScore = existing?.effortStudentScore?.toNumber() ?? null
  const nextDaysLate = daysLateUnprepared ?? existing?.daysLateUnprepared ?? 0

  let calculatedScore: number | null = null
  if (
    nextResponsiblePrepared !== null &&
    nextRespectfulWorks !== null &&
    nextEffortTeacherScore !== null &&
    nextEffortStudentScore !== null
  ) {
    calculatedScore = calculateApproachToLearning({
      responsiblePrepared: nextResponsiblePrepared,
      respectfulWorks: nextRespectfulWorks,
      effortTeacherScore: nextEffortTeacherScore,
      effortStudentScore: nextEffortStudentScore,
      daysLateUnprepared: nextDaysLate,
    }).calculatedScore
  }

  const record = await db.approachToLearningRecord.upsert({
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
      responsiblePrepared: nextResponsiblePrepared,
      respectfulWorks: nextRespectfulWorks,
      effortTeacherScore: nextEffortTeacherScore,
      daysLateUnprepared: nextDaysLate,
      calculatedScore,
    },
    update: {
      ...(responsiblePrepared !== undefined ? { responsiblePrepared } : {}),
      ...(respectfulWorks !== undefined ? { respectfulWorks } : {}),
      ...(effortTeacherScore !== undefined ? { effortTeacherScore } : {}),
      ...(daysLateUnprepared !== undefined ? { daysLateUnprepared } : {}),
      calculatedScore,
    },
  })

  await auditAtlRecord({
    actorId: session.user.id,
    actorRole: session.user.role,
    studentProfileId: studentId,
    historicalClassInstanceId: instanceId,
    action: existing ? AuditAction.ATL_RECORD_UPDATED : AuditAction.ATL_RECORD_CREATED,
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
