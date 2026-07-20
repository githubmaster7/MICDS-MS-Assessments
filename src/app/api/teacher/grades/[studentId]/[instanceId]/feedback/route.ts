import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { canTeacherGrade } from '@/lib/authorization'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey, apiLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ studentId: string; instanceId: string }>
}

const FeedbackSchema = z.object({
  standardNumber: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  feedback: z.string().max(2000).nullable(),
  isFeedbackStudentVisible: z.boolean(),
})

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

  const parsed = FeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { standardNumber, feedback, isFeedbackStudentVisible } = parsed.data

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!teacherProfile) return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 500 })

  const assessment = await db.teacherAssessment.findUnique({
    where: {
      teacherProfileId_historicalClassInstanceId_studentProfileId_standardNumber: {
        teacherProfileId: teacherProfile.id,
        historicalClassInstanceId: instanceId,
        studentProfileId: studentId,
        standardNumber,
      },
    },
    select: { id: true, feedback: true, isFeedbackStudentVisible: true },
  })

  if (!assessment) {
    return NextResponse.json(
      { error: 'No assessment found. Save a score before adding feedback.' },
      { status: 404 },
    )
  }

  const ip = ipRateLimitKey(req)

  const updated = await db.teacherAssessment.update({
    where: { id: assessment.id },
    data: { feedback, isFeedbackStudentVisible },
    select: { id: true, feedback: true, isFeedbackStudentVisible: true, updatedAt: true },
  })

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.TEACHER_ASSESSMENT_UPDATED,
    targetType: 'TeacherAssessment',
    targetId: assessment.id,
    targetLabel: `Standard ${standardNumber} feedback`,
    beforeValue: { feedback: assessment.feedback, isFeedbackStudentVisible: assessment.isFeedbackStudentVisible },
    afterValue: { feedback, isFeedbackStudentVisible },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({ data: updated })
}
