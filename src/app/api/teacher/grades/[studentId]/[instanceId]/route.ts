import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditGradeChange, auditGradeSnapshot, AuditAction, createAuditLog } from '@/lib/audit'
import { canTeacherGrade } from '@/lib/authorization'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { calculateStandardScore } from '@/lib/grading/standard-score'
import { createGradeSnapshot } from '@/lib/grading/snapshot'
import { getGradeAndSubmissionHistory } from '@/lib/grading/history'
import { ipRateLimitKey, apiLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ studentId: string; instanceId: string }>
}

const UpdateAssessmentSchema = z.object({
  standardNumber: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  // No raw `score` field on purpose — the score is always derived from
  // skillScores/promptScores/standard4Rating via the rubric formula, never
  // set directly, so it can't drift from the spreadsheet's percentage-tier
  // logic.
  feedback: z.string().max(2000).optional().nullable(),
  isFeedbackStudentVisible: z.boolean().optional(),
  skillScores: z
    .array(
      z.object({
        skillDefinitionId: z.string().uuid(),
        score: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      }),
    )
    .optional(),
  // Per-question teacher scores for Standard 2/3/4 concept questions.
  promptScores: z
    .array(
      z.object({
        promptDefinitionId: z.string().uuid(),
        score: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      }),
    )
    .optional(),
  // Standard 4 only: teacher's rating of observed teamwork/leadership,
  // separate from the student's own self-rating.
  standard4Rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
})

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.TEACHER) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { studentId, instanceId } = await params

  const canGrade = await canTeacherGrade(session.user.id, instanceId, studentId)
  // Allow read even if locked; only block mutations. canGrade itself can't
  // be used to gate the read below since it also returns false for a
  // legitimately-locked instance (which reads must still work for) - so
  // ownership and enrollment are re-checked directly instead.
  const instance = await db.historicalClassInstance.findUnique({
    where: { id: instanceId },
    select: { id: true, studentGroupId: true, teacherClassAssignment: { select: { teacherProfileId: true } } },
  })
  if (!instance) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!teacherProfile) return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 404 })

  if (instance.teacherClassAssignment.teacherProfileId !== teacherProfile.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const membership = await db.studentGroupMembership.findUnique({
    where: { studentGroupId_studentProfileId: { studentGroupId: instance.studentGroupId, studentProfileId: studentId } },
    select: { id: true },
  })
  if (!membership) {
    return NextResponse.json({ error: 'This student is not enrolled in this class.' }, { status: 403 })
  }

  const { assessments, snapshot, gradeHistory, studentHistory, submissionStatus, attemptCount } =
    await getGradeAndSubmissionHistory(studentId, instanceId)

  return NextResponse.json({
    data: {
      assessments,
      snapshot,
      canEdit: canGrade,
      gradeHistory,
      studentHistory,
      submissionStatus,
      attemptCount,
    },
  })
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

  // Authorization check
  const canGrade = await canTeacherGrade(session.user.id, instanceId, studentId)
  if (!canGrade) {
    return NextResponse.json(
      { error: 'You are not authorized to grade this student in this class instance, or it is locked.' },
      { status: 403 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = UpdateAssessmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { standardNumber, feedback, isFeedbackStudentVisible, skillScores, promptScores, standard4Rating } =
    parsed.data

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!teacherProfile) return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 500 })

  const ip = ipRateLimitKey(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  // The whole read-modify-write sequence (assessment upsert, skill/prompt
  // score upserts, the score recompute that reads them back, and the
  // resulting grade snapshot) runs as one transaction. Previously each step
  // was a separate, independently-committed query: a crash or error partway
  // through could leave skill scores saved but the rollup score stale, or a
  // recomputed score with no matching snapshot - and the snapshot step's
  // failure was swallowed (logged, not surfaced), so the API still reported
  // success while the student/parent-facing snapshot silently went stale.
  let assessment: Awaited<ReturnType<typeof db.teacherAssessment.upsert>>
  let before: { score: number | undefined; feedback: string | null } | null
  try {
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.teacherAssessment.findUnique({
        where: {
          teacherProfileId_historicalClassInstanceId_studentProfileId_standardNumber: {
            teacherProfileId: teacherProfile.id,
            historicalClassInstanceId: instanceId,
            studentProfileId: studentId,
            standardNumber,
          },
        },
        select: { id: true, score: true, feedback: true },
      })

      const beforeValue = existing ? { score: existing.score?.toNumber(), feedback: existing.feedback } : null

      let currentAssessment = await tx.teacherAssessment.upsert({
        where: {
          teacherProfileId_historicalClassInstanceId_studentProfileId_standardNumber: {
            teacherProfileId: teacherProfile.id,
            historicalClassInstanceId: instanceId,
            studentProfileId: studentId,
            standardNumber,
          },
        },
        create: {
          teacherProfileId: teacherProfile.id,
          historicalClassInstanceId: instanceId,
          studentProfileId: studentId,
          standardNumber,
          feedback: feedback ?? null,
          isFeedbackStudentVisible: isFeedbackStudentVisible ?? false,
        },
        update: {
          ...(feedback !== undefined ? { feedback } : {}),
          ...(isFeedbackStudentVisible !== undefined ? { isFeedbackStudentVisible } : {}),
        },
      })

      // Handle Standard 1 skill scores
      if (standardNumber === 1 && skillScores && skillScores.length > 0) {
        await Promise.all(
          skillScores.map((ss) =>
            tx.teacherSkillScore.upsert({
              where: {
                teacherAssessmentId_skillDefinitionId: {
                  teacherAssessmentId: currentAssessment.id,
                  skillDefinitionId: ss.skillDefinitionId,
                },
              },
              create: {
                teacherAssessmentId: currentAssessment.id,
                skillDefinitionId: ss.skillDefinitionId,
                score: ss.score,
              },
              update: { score: ss.score },
            }),
          ),
        )

        // Recalculate Standard 1 score
        const allSkillScores = await tx.teacherSkillScore.findMany({
          where: { teacherAssessmentId: currentAssessment.id },
          select: { skillDefinitionId: true, score: true },
        })
        const std1Result = calculateStandardScore(
          allSkillScores.map((s: { skillDefinitionId: string; score: unknown }) => ({ score: s.score as 1 | 2 | 3 | 4 })),
        )
        currentAssessment = await tx.teacherAssessment.update({
          where: { id: currentAssessment.id },
          data: { score: std1Result.score },
        })
      }

      // Handle Standard 2/3/4 per-question prompt scores + Standard 4's
      // teacher demonstration rating
      if ((standardNumber === 2 || standardNumber === 3 || standardNumber === 4) && promptScores && promptScores.length > 0) {
        await Promise.all(
          promptScores.map((ps) =>
            tx.teacherPromptScore.upsert({
              where: {
                teacherAssessmentId_promptDefinitionId: {
                  teacherAssessmentId: currentAssessment.id,
                  promptDefinitionId: ps.promptDefinitionId,
                },
              },
              create: {
                teacherAssessmentId: currentAssessment.id,
                promptDefinitionId: ps.promptDefinitionId,
                score: ps.score,
              },
              update: { score: ps.score },
            }),
          ),
        )
      }

      if (standardNumber === 4 && standard4Rating !== undefined) {
        await tx.teacherStandard4Rating.upsert({
          where: { teacherAssessmentId: currentAssessment.id },
          create: { teacherAssessmentId: currentAssessment.id, rating: standard4Rating },
          update: { rating: standard4Rating },
        })
      }

      if (
        (standardNumber === 2 || standardNumber === 3 || standardNumber === 4) &&
        (promptScores?.length || standard4Rating !== undefined)
      ) {
        const items: { itemId: string; score: 1 | 2 | 3 | 4 }[] = []

        const allPromptScores = await tx.teacherPromptScore.findMany({
          where: { teacherAssessmentId: currentAssessment.id },
          select: { promptDefinitionId: true, score: true },
        })
        items.push(
          ...allPromptScores.map((p: { promptDefinitionId: string; score: number }) => ({
            itemId: p.promptDefinitionId,
            score: p.score as 1 | 2 | 3 | 4,
          })),
        )

        if (standardNumber === 4) {
          const teacherRating = await tx.teacherStandard4Rating.findUnique({
            where: { teacherAssessmentId: currentAssessment.id },
            select: { rating: true },
          })
          if (teacherRating) {
            items.push({ itemId: 'teacher-demonstration-rating', score: teacherRating.rating as 1 | 2 | 3 | 4 })
          }

          const submission = await tx.studentSubmission.findUnique({
            where: {
              studentProfileId_historicalClassInstanceId_standardNumber: {
                studentProfileId: studentId,
                historicalClassInstanceId: instanceId,
                standardNumber: 4,
              },
            },
            include: { studentStandard4Ratings: true },
          })
          const selfRating = submission?.studentStandard4Ratings[0]
          if (selfRating) {
            items.push({ itemId: 'student-self-rating', score: selfRating.rating as 1 | 2 | 3 | 4 })
          }
        }

        if (items.length > 0) {
          const std234Result = calculateStandardScore(items)
          currentAssessment = await tx.teacherAssessment.update({
            where: { id: currentAssessment.id },
            data: { score: std234Result.score },
          })
        }
      }

      const instanceForSnapshot = await tx.historicalClassInstance.findUnique({
        where: { id: instanceId },
        select: { schoolYearId: true },
      })

      const snapshot = await createGradeSnapshot(tx, {
        studentProfileId: studentId,
        historicalClassInstanceId: instanceId,
        schoolYearId: instanceForSnapshot!.schoolYearId,
      })

      return { assessment: currentAssessment, before: beforeValue, snapshotId: snapshot.id }
    })

    assessment = result.assessment
    before = result.before

    await auditGradeSnapshot({
      actorId: session.user.id,
      studentProfileId: studentId,
      historicalClassInstanceId: instanceId,
      snapshotId: result.snapshotId,
      ipAddress: ip,
      userAgent,
    })
  } catch (err) {
    console.error('[teacher/grades] Failed to save grade:', err)
    return NextResponse.json(
      { error: 'Failed to save grade. Please try again.' },
      { status: 500 },
    )
  }

  await auditGradeChange({
    actorId: session.user.id,
    actorRole: session.user.role,
    studentProfileId: studentId,
    historicalClassInstanceId: instanceId,
    standardNumber,
    before,
    after: { score: assessment.score?.toNumber() ?? null, feedback },
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({ data: { assessment } })
}
