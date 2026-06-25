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

const UpdateSubmissionSchema = z.object({
  writtenResponses: z
    .array(
      z.object({
        promptDefinitionId: z.string().uuid(),
        responseText: z.string().min(1).max(5000),
      }),
    )
    .optional(),
  skillSelfRatings: z
    .array(
      z.object({
        skillDefinitionId: z.string().uuid(),
        rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      }),
    )
    .optional(),
  standard4SelfRating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  submit: z.boolean().optional().default(false),
})

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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

  const submission = await db.studentSubmission.findUnique({
    where: {
      studentProfileId_historicalClassInstanceId_standardNumber: {
        studentProfileId: studentProfile.id,
        historicalClassInstanceId: instanceId,
        standardNumber,
      },
    },
    include: {
      writtenResponses: {
        include: { promptDefinition: { select: { id: true, promptText: true, displayOrder: true } } },
      },
      studentSkillSelfRatings: {
        include: {
          skillDefinition: { select: { id: true, skillName: true, skillType: true, displayOrder: true } },
        },
      },
      studentStandard4Ratings: true,
    },
  })

  if (!submission) return NextResponse.json({ data: null })

  // Enforce student owns this submission (belt-and-suspenders)
  if (submission.studentProfileId !== studentProfile.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  // Visible teacher feedback
  const visibleFeedback = await db.teacherAssessment.findFirst({
    where: {
      studentProfileId: studentProfile.id,
      historicalClassInstanceId: instanceId,
      standardNumber,
      isFeedbackStudentVisible: true,
    },
    select: { feedback: true, score: true, assessedAt: true },
  })

  return NextResponse.json({ data: { submission, visibleFeedback } })
}

export async function PUT(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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

  // Check instance is not locked
  const instance = await db.historicalClassInstance.findUnique({
    where: { id: instanceId },
    select: { id: true, status: true },
  })
  if (!instance) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })
  if (instance.status === RotationStatus.LOCKED) {
    return NextResponse.json({ error: 'This class instance is locked.' }, { status: 409 })
  }

  // Find the existing submission
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
    return NextResponse.json(
      { error: 'Submission not found. Create a submission first.' },
      { status: 404 },
    )
  }

  // Enforce ownership
  if (submission.studentProfileId !== studentProfile.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  // Honor code must have been acknowledged
  if (!submission.honorCodeAcknowledgedAt) {
    return NextResponse.json({ error: 'Honor code must be acknowledged before submitting.' }, { status: 400 })
  }

  // Cannot edit if already submitted (unless reassessment flow)
  if (submission.status === SubmissionStatus.SUBMITTED || submission.status === SubmissionStatus.REASSESSMENT_SUBMITTED) {
    return NextResponse.json(
      { error: 'This submission has already been submitted.' },
      { status: 409 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = UpdateSubmissionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { writtenResponses, skillSelfRatings, standard4SelfRating, submit } = parsed.data
  const ip = ipRateLimitKey(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  await db.$transaction(async (tx) => {
    // Update written responses
    if (writtenResponses && writtenResponses.length > 0) {
      await Promise.all(
        writtenResponses.map((wr) =>
          tx.writtenResponse.upsert({
            where: {
              studentSubmissionId_promptDefinitionId_isReassessment: {
                studentSubmissionId: submission.id,
                promptDefinitionId: wr.promptDefinitionId,
                isReassessment: false,
              },
            },
            create: {
              studentSubmissionId: submission.id,
              promptDefinitionId: wr.promptDefinitionId,
              responseText: wr.responseText,
              isReassessment: false,
            },
            update: { responseText: wr.responseText },
          }),
        ),
      )
    }

    // Update skill self-ratings
    if (skillSelfRatings && skillSelfRatings.length > 0) {
      await Promise.all(
        skillSelfRatings.map((sr) =>
          tx.studentSkillSelfRating.upsert({
            where: {
              studentSubmissionId_skillDefinitionId: {
                studentSubmissionId: submission.id,
                skillDefinitionId: sr.skillDefinitionId,
              },
            },
            create: {
              studentSubmissionId: submission.id,
              studentProfileId: studentProfile.id,
              skillDefinitionId: sr.skillDefinitionId,
              rating: sr.rating,
            },
            update: { rating: sr.rating },
          }),
        ),
      )
    }

    // Standard 4 self-rating
    if (standard4SelfRating !== undefined) {
      await tx.studentStandard4SelfRating.upsert({
        where: { studentSubmissionId: submission.id },
        create: {
          studentSubmissionId: submission.id,
          studentProfileId: studentProfile.id,
          rating: standard4SelfRating,
        },
        update: { rating: standard4SelfRating },
      })
    }

    // Submit
    if (submit) {
      await tx.studentSubmission.update({
        where: { id: submission.id },
        data: {
          status: SubmissionStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      })
    }
  })

  await auditSubmission({
    actorId: session.user.id,
    actorRole: session.user.role,
    studentSubmissionId: submission.id,
    studentProfileId: studentProfile.id,
    action: submit
      ? AuditAction.STUDENT_SUBMISSION_SUBMITTED
      : AuditAction.STUDENT_SUBMISSION_UPDATED,
    after: { standardNumber, submitted: submit },
    ipAddress: ip,
    userAgent,
  })

  const updated = await db.studentSubmission.findUnique({
    where: { id: submission.id },
    include: {
      writtenResponses: true,
      studentSkillSelfRatings: true,
      studentStandard4Ratings: true,
    },
  })

  return NextResponse.json({ data: updated })
}
