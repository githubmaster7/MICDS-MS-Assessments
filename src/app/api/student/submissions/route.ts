import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditSubmission, AuditAction } from '@/lib/audit'
import { Role, SubmissionStatus, RotationStatus } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey, apiLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

const HONOR_CODE_VERSION = '2024-v1'

const CreateSubmissionSchema = z.object({
  instanceId: z.string().uuid(),
  standardNumber: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  honorCodeAcknowledged: z.boolean(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = CreateSubmissionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { instanceId, standardNumber, honorCodeAcknowledged } = parsed.data

  if (!honorCodeAcknowledged) {
    return NextResponse.json(
      { error: 'Honor code acknowledgment is required.' },
      { status: 400 },
    )
  }

  const studentProfile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!studentProfile) return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 })

  // Verify the class instance exists and is the student's current active class
  const instance = await db.historicalClassInstance.findUnique({
    where: { id: instanceId },
    select: { id: true, status: true, studentGroupId: true },
  })
  if (!instance) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })
  if (instance.status !== RotationStatus.ACTIVE) {
    return NextResponse.json(
      { error: 'This class instance is not currently active and is not accepting submissions.' },
      { status: 409 },
    )
  }

  // Verify student is a member of the class instance's group
  const membership = await db.studentGroupMembership.findUnique({
    where: {
      studentGroupId_studentProfileId: {
        studentGroupId: instance.studentGroupId,
        studentProfileId: studentProfile.id,
      },
    },
    select: { id: true, leftAt: true },
  })
  if (!membership) {
    return NextResponse.json({ error: 'You are not enrolled in this class.' }, { status: 403 })
  }

  const ip = ipRateLimitKey(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  const existing = await db.studentSubmission.findUnique({
    where: {
      studentProfileId_historicalClassInstanceId_standardNumber: {
        studentProfileId: studentProfile.id,
        historicalClassInstanceId: instanceId,
        standardNumber,
      },
    },
    select: { id: true, status: true },
  })

  if (existing) {
    // Update honor code acknowledgment if re-acknowledging
    const updated = await db.studentSubmission.update({
      where: { id: existing.id },
      data: {
        honorCodeAcknowledgedAt: new Date(),
        honorCodeVersion: HONOR_CODE_VERSION,
      },
    })

    await auditSubmission({
      actorId: session.user.id,
      actorRole: session.user.role,
      studentSubmissionId: updated.id,
      studentProfileId: studentProfile.id,
      action: AuditAction.STUDENT_SUBMISSION_UPDATED,
      after: { honorCodeAcknowledged: true },
      ipAddress: ip,
      userAgent,
    })

    return NextResponse.json({ data: updated })
  }

  const submission = await db.studentSubmission.create({
    data: {
      studentProfileId: studentProfile.id,
      historicalClassInstanceId: instanceId,
      standardNumber,
      status: SubmissionStatus.DRAFT,
      honorCodeAcknowledgedAt: new Date(),
      honorCodeVersion: HONOR_CODE_VERSION,
    },
  })

  await auditSubmission({
    actorId: session.user.id,
    actorRole: session.user.role,
    studentSubmissionId: submission.id,
    studentProfileId: studentProfile.id,
    action: AuditAction.STUDENT_SUBMISSION_CREATED,
    after: { instanceId, standardNumber, honorCodeVersion: HONOR_CODE_VERSION },
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({ data: submission }, { status: 201 })
}
