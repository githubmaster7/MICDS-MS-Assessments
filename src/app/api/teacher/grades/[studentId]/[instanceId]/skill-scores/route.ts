import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { createAuditLog, AuditAction } from '@/lib/audit'
import { canTeacherGrade } from '@/lib/authorization'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { calculateStandard1 } from '@/lib/grading/standard1'
import { ipRateLimitKey } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ studentId: string; instanceId: string }>
}

const SkillScoresBatchSchema = z.object({
  scores: z
    .array(
      z.object({
        skillDefinitionId: z.string().uuid(),
        score: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      }),
    )
    .min(1),
})

export async function PUT(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.TEACHER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { studentId, instanceId } = await params

  const canGrade = await canTeacherGrade(session.user.id, instanceId)
  if (!canGrade) {
    return NextResponse.json(
      { error: 'You are not authorized to grade this class instance, or it is locked.' },
      { status: 403 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = SkillScoresBatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { scores } = parsed.data

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!teacherProfile) return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 500 })

  // Find or create the Standard 1 TeacherAssessment
  const assessment = await db.teacherAssessment.upsert({
    where: {
      teacherProfileId_historicalClassInstanceId_studentProfileId_standardNumber: {
        teacherProfileId: teacherProfile.id,
        historicalClassInstanceId: instanceId,
        studentProfileId: studentId,
        standardNumber: 1,
      },
    },
    create: {
      teacherProfileId: teacherProfile.id,
      historicalClassInstanceId: instanceId,
      studentProfileId: studentId,
      standardNumber: 1,
    },
    update: {},
    select: { id: true },
  })

  const ip = ipRateLimitKey(req)

  // Upsert all skill scores in parallel
  await Promise.all(
    scores.map((ss) =>
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

  // Re-read all scores and recalculate Standard 1 composite
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

  await createAuditLog({
    actorId: session.user.id,
    actorRole: session.user.role,
    action: AuditAction.TEACHER_SKILL_SCORE_SAVED,
    targetType: 'TeacherAssessment',
    targetId: assessment.id,
    targetLabel: `Standard 1 skill scores`,
    afterValue: {
      calculatedScore: std1Result.score,
      breakdown: std1Result.breakdown,
      scoresUpdated: scores.length,
    },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  return NextResponse.json({
    data: {
      std1Score: std1Result.score,
      breakdown: std1Result.breakdown,
      skillScores: allSkillScores,
    },
  })
}
