import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditSubmission, AuditAction } from '@/lib/audit'
import { Role, SubmissionStatus, RotationStatus } from '@prisma/client'
import { z } from 'zod'
import { ipRateLimitKey } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ instanceId: string; standardNumber: string }>
}

const ReassessmentSchema = z.object({
  writtenResponses: z
    .array(
      z.object({
        promptDefinitionId: z.string().uuid(),
        responseText: z.string().min(1).max(5000),
      }),
    )
    .min(1, 'At least one written response is required for reassessment.'),
  honorCodeAcknowledged: z.boolean(),
})

export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.STUDENT) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { instanceId, standardNumber: stdStr } = await params
  const standardNumber = parseInt(stdStr, 10)
  if (![1, 2, 3, 4].includes(standardNumber)) {
    return NextResponse.json({ error: 'Invalid standard number.' }, { status: 400 })
  }

  const studentProfile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!studentProfile) return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 })

  // Class instance must not be locked
  const instance = await db.historicalClassInstance.findUnique({
    where: { id: instanceId },
    select: { id: true, status: true },
  })
  if (!instance) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })
  if (instance.status === RotationStatus.LOCKED) {
    return NextResponse.json({ error: 'This class instance is locked.' }, { status: 409 })
  }

  // Find original submission
  const submission = await db.studentSubmission.findUnique({
    where: {
      studentProfileId_historicalClassInstanceId_standardNumber: {
        studentProfileId: studentProfile.id,
        historicalClassInstanceId: instanceId,
        standardNumber,
      },
    },
    select: { id: true, studentProfileId: true, status: true, honorCodeAcknowledgedAt: true },
  })

  if (!submission) {
    return NextResponse.json({ error: 'Original submission not found.' }, { status: 404 })
  }

  // Ownership check
  if (submission.studentProfileId !== studentProfile.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  if (submission.status !== SubmissionStatus.SUBMITTED) {
    return NextResponse.json(
      { error: 'Reassessment can only be submitted after the original submission.' },
      { status: 409 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = ReassessmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { writtenResponses, honorCodeAcknowledged } = parsed.data

  if (!honorCodeAcknowledged) {
    return NextResponse.json({ error: 'Honor code acknowledgment is required.' }, { status: 400 })
  }

  const ip = ipRateLimitKey(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  await db.$transaction(async (tx: typeof db) => {
    // Upsert reassessment written responses (isReassessment=true)
    await Promise.all(
      writtenResponses.map((wr) =>
        tx.writtenResponse.upsert({
          where: {
            studentSubmissionId_promptDefinitionId_isReassessment: {
              studentSubmissionId: submission.id,
              promptDefinitionId: wr.promptDefinitionId,
              isReassessment: true,
            },
          },
          create: {
            studentSubmissionId: submission.id,
            promptDefinitionId: wr.promptDefinitionId,
            responseText: wr.responseText,
            isReassessment: true,
          },
          update: { responseText: wr.responseText },
        }),
      ),
    )

    await tx.studentSubmission.update({
      where: { id: submission.id },
      data: {
        status: SubmissionStatus.REASSESSMENT_SUBMITTED,
        reassessmentSubmittedAt: new Date(),
        honorCodeAcknowledgedAt: new Date(), // Re-acknowledge for reassessment
      },
    })
  })

  await auditSubmission({
    actorId: session.user.id,
    actorRole: session.user.role,
    studentSubmissionId: submission.id,
    studentProfileId: studentProfile.id,
    action: AuditAction.STUDENT_SUBMISSION_SUBMITTED,
    after: { reassessment: true, standardNumber },
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({ message: 'Reassessment submitted successfully.' })
}
