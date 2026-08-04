import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditGradeChange, auditGradeSnapshot } from '@/lib/audit'
import { bulkGradingLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'
import { canTeacherGrade } from '@/lib/authorization'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { calculateStandardScore } from '@/lib/grading/standard-score'
import { createGradeSnapshot } from '@/lib/grading/snapshot'
import { ipRateLimitKey } from '@/lib/rate-limit'

const SkillScoreInput = z.object({
  skillDefinitionId: z.string().uuid(),
  score: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
})

const PromptScoreInput = z.object({
  promptDefinitionId: z.string().uuid(),
  score: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
})

const BulkGradeEntry = z.object({
  studentProfileId: z.string().uuid(),
  instanceId: z.string().uuid(),
  standardNumber: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  // No raw `score` field on purpose — always derived from
  // skillScores/promptScores/standard4Rating, never set directly.
  feedback: z.string().max(2000).optional(),
  isFeedbackStudentVisible: z.boolean().optional(),
  skillScores: z.array(SkillScoreInput).optional(),
  promptScores: z.array(PromptScoreInput).optional(),
  standard4Rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
})

const BulkGradeSchema = z.object({
  grades: z.array(BulkGradeEntry).min(1).max(50),
  confirm: z.boolean().default(false),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.TEACHER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const rl = await checkRateLimit(bulkGradingLimiter, userRateLimitKey(session.user.id))
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many grading requests. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.msBeforeNext / 1000)) } },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = BulkGradeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { grades, confirm } = parsed.data
  const ip = ipRateLimitKey(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  // Authorization: verify the teacher can grade each (student, instance) pair
  // being submitted — owning the instance is not enough on its own, the
  // student must actually be enrolled in it (see canTeacherGrade). Admins
  // bypass this per-assignment check, consistent with every other admin/**
  // route in the app.
  if (session.user.role === Role.TEACHER) {
    const uniquePairs = [...new Map(grades.map((g) => [`${g.studentProfileId}:${g.instanceId}`, g])).values()]
    const authChecks = await Promise.all(
      uniquePairs.map((g) => canTeacherGrade(session.user.id, g.instanceId, g.studentProfileId)),
    )

    const unauthorizedPairs = uniquePairs.filter((_, i) => !authChecks[i])
    if (unauthorizedPairs.length > 0) {
      return NextResponse.json(
        { error: 'You are not authorized to grade one or more of the specified students.' },
        { status: 403 },
      )
    }
  }

  // Preview mode
  if (!confirm) {
    return NextResponse.json({
      data: {
        preview: grades.map((g) => ({
          studentProfileId: g.studentProfileId,
          instanceId: g.instanceId,
          standardNumber: g.standardNumber,
          willUpdate: true,
        })),
        message: 'Send confirm=true to apply these grades.',
      },
    })
  }

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!teacherProfile) {
    return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 500 })
  }
  // Re-bound to non-nullable consts for use inside the saveOne closure below -
  // TS can't carry the null-narrowing from the guards above across a nested
  // function boundary.
  const teacherProfileId = teacherProfile.id
  const actorId = session.user.id
  const actorRole = session.user.role

  // schoolYearId only varies per instanceId, not per grade entry - fetch it
  // once per unique instance instead of once per entry (previously refetched
  // redundantly, serially, inside the loop below for every single grade).
  const uniqueInstanceIdsForYear = [...new Set(grades.map((g) => g.instanceId))]
  const instances = await db.historicalClassInstance.findMany({
    where: { id: { in: uniqueInstanceIdsForYear } },
    select: { id: true, schoolYearId: true },
  })
  const schoolYearByInstance = new Map(instances.map((i) => [i.id, i.schoolYearId]))

  // Each entry is saved independently and atomically (assessment + item
  // scores + recomputed rollup + grade snapshot all in one transaction, same
  // as the single-grade endpoint), but entries themselves run concurrently
  // rather than one-at-a-time - a 25-30 student roster no longer means
  // 150+ sequential round trips in a single request.
  async function saveOne(grade: (typeof grades)[number]): Promise<{ studentProfileId: string; standardNumber: number; status: string }> {
    try {
      const schoolYearId = schoolYearByInstance.get(grade.instanceId)
      if (!schoolYearId) {
        throw new Error(`Class instance ${grade.instanceId} not found.`)
      }

      const before = await db.$transaction(async (tx) => {
        const existing = await tx.teacherAssessment.findUnique({
          where: {
            teacherProfileId_historicalClassInstanceId_studentProfileId_standardNumber: {
              teacherProfileId: teacherProfileId,
              historicalClassInstanceId: grade.instanceId,
              studentProfileId: grade.studentProfileId,
              standardNumber: grade.standardNumber,
            },
          },
          select: { id: true, score: true, feedback: true },
        })

        const beforeValue = existing ? { score: existing.score?.toNumber(), feedback: existing.feedback } : null

        let assessment = await tx.teacherAssessment.upsert({
          where: {
            teacherProfileId_historicalClassInstanceId_studentProfileId_standardNumber: {
              teacherProfileId: teacherProfileId,
              historicalClassInstanceId: grade.instanceId,
              studentProfileId: grade.studentProfileId,
              standardNumber: grade.standardNumber,
            },
          },
          create: {
            teacherProfileId: teacherProfileId,
            historicalClassInstanceId: grade.instanceId,
            studentProfileId: grade.studentProfileId,
            standardNumber: grade.standardNumber,
            feedback: grade.feedback ?? null,
            isFeedbackStudentVisible: grade.isFeedbackStudentVisible ?? false,
          },
          update: {
            ...(grade.feedback !== undefined ? { feedback: grade.feedback } : {}),
            ...(grade.isFeedbackStudentVisible !== undefined
              ? { isFeedbackStudentVisible: grade.isFeedbackStudentVisible }
              : {}),
          },
        })

        // Handle skill scores for standard 1
        if (grade.standardNumber === 1 && grade.skillScores && grade.skillScores.length > 0) {
          await Promise.all(
            grade.skillScores.map((ss) =>
              tx.teacherSkillScore.upsert({
                where: {
                  teacherAssessmentId_skillDefinitionId: {
                    teacherAssessmentId: assessment.id,
                    skillDefinitionId: ss.skillDefinitionId,
                  },
                },
                create: {
                  teacherAssessmentId: assessment.id,
                  skillDefinitionId: ss.skillDefinitionId,
                  score: ss.score,
                },
                update: { score: ss.score },
              }),
            ),
          )

          // Recalculate Standard 1 score from skill scores
          const allSkillScores = await tx.teacherSkillScore.findMany({
            where: { teacherAssessmentId: assessment.id },
            select: { skillDefinitionId: true, score: true },
          })
          const std1Result = calculateStandardScore(
            allSkillScores.map((s: { skillDefinitionId: string; score: unknown }) => ({ score: s.score as 1 | 2 | 3 | 4 })),
          )
          assessment = await tx.teacherAssessment.update({
            where: { id: assessment.id },
            data: { score: std1Result.score },
          })
        }

        // Handle per-question prompt scores for standards 2/3/4 + Standard 4's
        // teacher demonstration rating
        if (
          (grade.standardNumber === 2 || grade.standardNumber === 3 || grade.standardNumber === 4) &&
          grade.promptScores &&
          grade.promptScores.length > 0
        ) {
          await Promise.all(
            grade.promptScores.map((ps) =>
              tx.teacherPromptScore.upsert({
                where: {
                  teacherAssessmentId_promptDefinitionId: {
                    teacherAssessmentId: assessment.id,
                    promptDefinitionId: ps.promptDefinitionId,
                  },
                },
                create: {
                  teacherAssessmentId: assessment.id,
                  promptDefinitionId: ps.promptDefinitionId,
                  score: ps.score,
                },
                update: { score: ps.score },
              }),
            ),
          )
        }

        if (grade.standardNumber === 4 && grade.standard4Rating !== undefined) {
          await tx.teacherStandard4Rating.upsert({
            where: { teacherAssessmentId: assessment.id },
            create: { teacherAssessmentId: assessment.id, rating: grade.standard4Rating },
            update: { rating: grade.standard4Rating },
          })
        }

        if (
          (grade.standardNumber === 2 || grade.standardNumber === 3 || grade.standardNumber === 4) &&
          (grade.promptScores?.length || grade.standard4Rating !== undefined)
        ) {
          const items: { itemId: string; score: 1 | 2 | 3 | 4 }[] = []

          const allPromptScores = await tx.teacherPromptScore.findMany({
            where: { teacherAssessmentId: assessment.id },
            select: { promptDefinitionId: true, score: true },
          })
          items.push(
            ...allPromptScores.map((p: { promptDefinitionId: string; score: number }) => ({
              itemId: p.promptDefinitionId,
              score: p.score as 1 | 2 | 3 | 4,
            })),
          )

          if (grade.standardNumber === 4) {
            const teacherRating = await tx.teacherStandard4Rating.findUnique({
              where: { teacherAssessmentId: assessment.id },
              select: { rating: true },
            })
            if (teacherRating) {
              items.push({ itemId: 'teacher-demonstration-rating', score: teacherRating.rating as 1 | 2 | 3 | 4 })
            }

            const submission = await tx.studentSubmission.findUnique({
              where: {
                studentProfileId_historicalClassInstanceId_standardNumber: {
                  studentProfileId: grade.studentProfileId,
                  historicalClassInstanceId: grade.instanceId,
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
            assessment = await tx.teacherAssessment.update({
              where: { id: assessment.id },
              data: { score: std234Result.score },
            })
          }
        }

        const snapshot = await createGradeSnapshot(tx, {
          studentProfileId: grade.studentProfileId,
          historicalClassInstanceId: grade.instanceId,
          schoolYearId,
        })

        return { beforeValue, assessment, snapshotId: snapshot.id }
      })

      await auditGradeSnapshot({
        actorId: actorId,
        studentProfileId: grade.studentProfileId,
        historicalClassInstanceId: grade.instanceId,
        snapshotId: before.snapshotId,
        ipAddress: ip,
        userAgent,
      })

      await auditGradeChange({
        actorId: actorId,
        actorRole: actorRole,
        studentProfileId: grade.studentProfileId,
        historicalClassInstanceId: grade.instanceId,
        standardNumber: grade.standardNumber,
        before: before.beforeValue,
        after: { score: before.assessment.score?.toNumber() ?? null, feedback: grade.feedback },
        ipAddress: ip,
        userAgent,
      })

      return { studentProfileId: grade.studentProfileId, standardNumber: grade.standardNumber, status: 'saved' }
    } catch (err) {
      console.error('[bulk-grade] Failed to save grade:', err)
      return { studentProfileId: grade.studentProfileId, standardNumber: grade.standardNumber, status: 'error' }
    }
  }

  // Cap concurrency so a 50-entry batch doesn't open 50 simultaneous
  // transactions against the connection pool at once.
  const CONCURRENCY = 8
  const results: { studentProfileId: string; standardNumber: number; status: string }[] = []
  for (let i = 0; i < grades.length; i += CONCURRENCY) {
    const batch = grades.slice(i, i + CONCURRENCY)
    results.push(...(await Promise.all(batch.map(saveOne))))
  }

  return NextResponse.json({ data: { results } })
}
