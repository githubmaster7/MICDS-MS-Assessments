import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db, type TxClient } from '@/lib/db'
import { auditSubmission, AuditAction } from '@/lib/audit'
import { Role, SubmissionStatus, RotationStatus } from '@prisma/client'
import { z } from 'zod'
import { isRevised } from '@/lib/grading/resubmission'
import { hasOpenStudentRegradeGrant } from '@/lib/authorization'
import { ipRateLimitKey, apiLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

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
  // Student self-score on Standard 2/3 concept questions. Informational
  // only — the teacher's TeacherPromptScore always wins for grade calc.
  promptSelfRatings: z
    .array(
      z.object({
        promptDefinitionId: z.string().uuid(),
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
      studentPromptRatings: {
        include: {
          promptDefinition: { select: { id: true, promptText: true, displayOrder: true } },
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

  const rl = await checkRateLimit(apiLimiter, userRateLimitKey(session.user.id))
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.msBeforeNext / 1000)) } },
    )
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

  // Only the currently active class instance accepts submission edits —
  // unless an admin has explicitly reopened this instance for this
  // student's resubmission via a ClassRegradeGrant.
  const instance = await db.historicalClassInstance.findUnique({
    where: { id: instanceId },
    select: { id: true, status: true },
  })
  if (!instance) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })
  if (instance.status !== RotationStatus.ACTIVE) {
    const reopened = await hasOpenStudentRegradeGrant(studentProfile.id, instanceId)
    if (!reopened) {
      return NextResponse.json(
        { error: 'This class instance is not currently active.' },
        { status: 409 },
      )
    }
  }

  // Find the existing submission, including its current live answers/scores
  // — needed both to snapshot the outgoing attempt and to check resubmission
  // eligibility.
  const submission = await db.studentSubmission.findUnique({
    where: {
      studentProfileId_historicalClassInstanceId_standardNumber: {
        studentProfileId: studentProfile.id,
        historicalClassInstanceId: instanceId,
        standardNumber,
      },
    },
    include: {
      writtenResponses: true,
      studentSkillSelfRatings: true,
      studentPromptRatings: true,
      studentStandard4Ratings: true,
    },
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

  const { writtenResponses, skillSelfRatings, promptSelfRatings, standard4SelfRating, submit } = parsed.data

  const alreadyFinalized =
    submission.status === SubmissionStatus.SUBMITTED || submission.status === SubmissionStatus.REASSESSMENT_SUBMITTED

  // Once finalized, incremental draft saves are no longer meaningful — the
  // only way to change a finalized submission is a full resubmission
  // (submit: true), which is gated below.
  if (alreadyFinalized && !submit) {
    return NextResponse.json(
      { error: 'This has already been submitted. Resubmit to make changes.' },
      { status: 409 },
    )
  }

  const isResubmission = alreadyFinalized && submit

  if (isResubmission) {
    let scoreChanged = false
    for (const sr of skillSelfRatings ?? []) {
      const existing = submission.studentSkillSelfRatings.find((e) => e.skillDefinitionId === sr.skillDefinitionId)
      if (!existing || existing.rating !== sr.rating) {
        scoreChanged = true
        break
      }
    }
    if (!scoreChanged) {
      for (const pr of promptSelfRatings ?? []) {
        const existing = submission.studentPromptRatings.find((e) => e.promptDefinitionId === pr.promptDefinitionId)
        if (!existing || existing.rating !== pr.rating) {
          scoreChanged = true
          break
        }
      }
    }
    if (!scoreChanged && standard4SelfRating !== undefined) {
      const existing = submission.studentStandard4Ratings[0]
      if (!existing || existing.rating !== standard4SelfRating) scoreChanged = true
    }

    let commentRevised = false
    for (const wr of writtenResponses ?? []) {
      const existing = submission.writtenResponses.find((e) => e.promptDefinitionId === wr.promptDefinitionId)
      const oldText = existing?.responseText ?? ''
      if (isRevised(oldText, wr.responseText)) {
        commentRevised = true
        break
      }
    }

    if (!scoreChanged && !commentRevised) {
      return NextResponse.json(
        {
          error: 'Resubmission requires a meaningful change: adjust at least one score, or revise an answer.',
        },
        { status: 409 },
      )
    }
  }

  const ip = ipRateLimitKey(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  await db.$transaction(async (tx: TxClient) => {
    // A resubmission supersedes the currently-live attempt — freeze it into
    // history before overwriting it below.
    if (isResubmission) {
      await tx.submissionHistoryEntry.create({
        data: {
          studentSubmissionId: submission.id,
          attemptNumber: submission.latestAttemptNumber,
          submittedAt: submission.submittedAt ?? submission.createdAt,
          snapshotData: {
            writtenResponses: submission.writtenResponses.map((wr) => ({
              promptDefinitionId: wr.promptDefinitionId,
              responseText: wr.responseText,
            })),
            skillSelfRatings: submission.studentSkillSelfRatings.map((sr) => ({
              skillDefinitionId: sr.skillDefinitionId,
              rating: sr.rating,
            })),
            promptSelfRatings: submission.studentPromptRatings.map((pr) => ({
              promptDefinitionId: pr.promptDefinitionId,
              rating: pr.rating,
            })),
            standard4SelfRating: submission.studentStandard4Ratings[0]?.rating ?? null,
          },
        },
      })
    }

    // Update written responses
    if (writtenResponses && writtenResponses.length > 0) {
      await Promise.all(
        writtenResponses.map((wr) =>
          tx.writtenResponse.upsert({
            where: {
              studentSubmissionId_promptDefinitionId: {
                studentSubmissionId: submission.id,
                promptDefinitionId: wr.promptDefinitionId,
              },
            },
            create: {
              studentSubmissionId: submission.id,
              promptDefinitionId: wr.promptDefinitionId,
              responseText: wr.responseText,
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

    // Update prompt self-ratings (Standard 2/3 concept questions)
    if (promptSelfRatings && promptSelfRatings.length > 0) {
      await Promise.all(
        promptSelfRatings.map((pr) =>
          tx.studentPromptRating.upsert({
            where: {
              studentSubmissionId_promptDefinitionId: {
                studentSubmissionId: submission.id,
                promptDefinitionId: pr.promptDefinitionId,
              },
            },
            create: {
              studentSubmissionId: submission.id,
              studentProfileId: studentProfile.id,
              promptDefinitionId: pr.promptDefinitionId,
              rating: pr.rating,
            },
            update: { rating: pr.rating },
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

    // Submit / resubmit
    if (submit) {
      await tx.studentSubmission.update({
        where: { id: submission.id },
        data: {
          status: isResubmission ? SubmissionStatus.REASSESSMENT_SUBMITTED : SubmissionStatus.SUBMITTED,
          submittedAt: new Date(),
          ...(isResubmission
            ? { reassessmentSubmittedAt: new Date(), latestAttemptNumber: submission.latestAttemptNumber + 1 }
            : {}),
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
    after: { standardNumber, submitted: submit, resubmission: isResubmission },
    ipAddress: ip,
    userAgent,
  })

  const updated = await db.studentSubmission.findUnique({
    where: { id: submission.id },
    include: {
      writtenResponses: true,
      studentSkillSelfRatings: true,
      studentPromptRatings: true,
      studentStandard4Ratings: true,
    },
  })

  return NextResponse.json({ data: updated })
}
