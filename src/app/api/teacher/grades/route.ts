import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditGradeChange, AuditAction, createAuditLog } from '@/lib/audit'
import { bulkGradingLimiter, checkRateLimit, userRateLimitKey } from '@/lib/rate-limit'
import { canTeacherGrade } from '@/lib/authorization'
import { Role, RotationStatus } from '@prisma/client'
import { z } from 'zod'
import { calculateStandard1 } from '@/lib/grading/standard1'
import { calculateStandard234 } from '@/lib/grading/standards234'
import { standardScoreToInternal, internalAverageToLetterGrade } from '@/lib/grading/conversion'
import { ipRateLimitKey } from '@/lib/rate-limit'

const SkillScoreInput = z.object({
  skillDefinitionId: z.string().uuid(),
  score: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
})

const BulkGradeEntry = z.object({
  studentProfileId: z.string().uuid(),
  instanceId: z.string().uuid(),
  standardNumber: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  score: z.number().optional(),
  feedback: z.string().max(2000).optional(),
  isFeedbackStudentVisible: z.boolean().optional(),
  skillScores: z.array(SkillScoreInput).optional(),
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

  // Authorization: verify teacher can grade each instance
  const uniqueInstanceIds = [...new Set(grades.map((g) => g.instanceId))]
  const authChecks = await Promise.all(
    uniqueInstanceIds.map((instanceId) => canTeacherGrade(session.user.id, instanceId)),
  )

  const unauthorizedInstances = uniqueInstanceIds.filter((_, i) => !authChecks[i])
  if (unauthorizedInstances.length > 0) {
    return NextResponse.json(
      { error: 'You are not authorized to grade one or more of the specified class instances.' },
      { status: 403 },
    )
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

  const results: { studentProfileId: string; standardNumber: number; status: string }[] = []

  for (const grade of grades) {
    try {
      const existing = await db.teacherAssessment.findUnique({
        where: {
          teacherProfileId_historicalClassInstanceId_studentProfileId_standardNumber: {
            teacherProfileId: teacherProfile.id,
            historicalClassInstanceId: grade.instanceId,
            studentProfileId: grade.studentProfileId,
            standardNumber: grade.standardNumber,
          },
        },
        select: { id: true, score: true, feedback: true },
      })

      const before = existing
        ? { score: existing.score?.toNumber(), feedback: existing.feedback }
        : null

      const assessment = await db.teacherAssessment.upsert({
        where: {
          teacherProfileId_historicalClassInstanceId_studentProfileId_standardNumber: {
            teacherProfileId: teacherProfile.id,
            historicalClassInstanceId: grade.instanceId,
            studentProfileId: grade.studentProfileId,
            standardNumber: grade.standardNumber,
          },
        },
        create: {
          teacherProfileId: teacherProfile.id,
          historicalClassInstanceId: grade.instanceId,
          studentProfileId: grade.studentProfileId,
          standardNumber: grade.standardNumber,
          score: grade.score ?? null,
          feedback: grade.feedback ?? null,
          isFeedbackStudentVisible: grade.isFeedbackStudentVisible ?? false,
        },
        update: {
          ...(grade.score !== undefined ? { score: grade.score } : {}),
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
            db.teacherSkillScore.upsert({
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
        const allSkillScores = await db.teacherSkillScore.findMany({
          where: { teacherAssessmentId: assessment.id },
          select: { skillDefinitionId: true, score: true },
        })
        const std1Result = calculateStandard1(
          allSkillScores.map((s) => ({ skillId: s.skillDefinitionId, score: s.score as 1 | 2 | 3 | 4 })),
        )
        await db.teacherAssessment.update({
          where: { id: assessment.id },
          data: { score: std1Result.score },
        })
      }

      await auditGradeChange({
        actorId: session.user.id,
        actorRole: session.user.role,
        studentProfileId: grade.studentProfileId,
        historicalClassInstanceId: grade.instanceId,
        standardNumber: grade.standardNumber,
        before,
        after: { score: grade.score, feedback: grade.feedback },
        ipAddress: ip,
        userAgent,
      })

      results.push({ studentProfileId: grade.studentProfileId, standardNumber: grade.standardNumber, status: 'saved' })
    } catch (err) {
      console.error('[bulk-grade] Failed to save grade:', err)
      results.push({ studentProfileId: grade.studentProfileId, standardNumber: grade.standardNumber, status: 'error' })
    }
  }

  return NextResponse.json({ data: { results } })
}
