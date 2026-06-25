import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditGradeChange, auditGradeSnapshot, AuditAction, createAuditLog } from '@/lib/audit'
import { canTeacherGrade } from '@/lib/authorization'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { calculateStandard1 } from '@/lib/grading/standard1'
import { standardScoreToInternal, internalAverageToLetterGrade } from '@/lib/grading/conversion'
import { ipRateLimitKey } from '@/lib/rate-limit'

interface RouteParams {
  params: Promise<{ studentId: string; instanceId: string }>
}

const UpdateAssessmentSchema = z.object({
  standardNumber: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  score: z.number().optional(),
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
})

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.TEACHER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { studentId, instanceId } = await params

  const canGrade = await canTeacherGrade(session.user.id, instanceId)
  // Allow read even if locked; only block mutations
  const instance = await db.historicalClassInstance.findUnique({
    where: { id: instanceId },
    select: { id: true, status: true, teacherClassAssignment: { select: { teacherProfileId: true } } },
  })
  if (!instance) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!teacherProfile) return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 404 })

  if (instance.teacherClassAssignment.teacherProfileId !== teacherProfile.id && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const [assessments, snapshot] = await Promise.all([
    db.teacherAssessment.findMany({
      where: {
        historicalClassInstanceId: instanceId,
        studentProfileId: studentId,
      },
      include: {
        teacherSkillScores: {
          include: {
            skillDefinition: { select: { id: true, skillName: true, skillType: true, displayOrder: true } },
          },
        },
        teacherStandard4Ratings: true,
      },
    }),
    db.gradeCalculationSnapshot.findFirst({
      where: { studentProfileId: studentId, historicalClassInstanceId: instanceId },
      orderBy: { calculatedAt: 'desc' },
    }),
  ])

  return NextResponse.json({ data: { assessments, snapshot, canEdit: canGrade } })
}

export async function PUT(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.TEACHER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { studentId, instanceId } = await params

  // Authorization check
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

  const parsed = UpdateAssessmentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 })
  }

  const { standardNumber, score, feedback, isFeedbackStudentVisible, skillScores } = parsed.data

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!teacherProfile) return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 500 })

  const ip = ipRateLimitKey(req)
  const userAgent = req.headers.get('user-agent') ?? undefined

  const existing = await db.teacherAssessment.findUnique({
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

  const before = existing ? { score: existing.score?.toNumber(), feedback: existing.feedback } : null

  const assessment = await db.teacherAssessment.upsert({
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
      score: score ?? null,
      feedback: feedback ?? null,
      isFeedbackStudentVisible: isFeedbackStudentVisible ?? false,
    },
    update: {
      ...(score !== undefined ? { score } : {}),
      ...(feedback !== undefined ? { feedback } : {}),
      ...(isFeedbackStudentVisible !== undefined ? { isFeedbackStudentVisible } : {}),
    },
  })

  // Handle Standard 1 skill scores
  if (standardNumber === 1 && skillScores && skillScores.length > 0) {
    await Promise.all(
      skillScores.map((ss) =>
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

    // Recalculate Standard 1 score
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

  // Recalculate grade snapshot
  await recalculateSnapshot({
    studentProfileId: studentId,
    instanceId,
    teacherProfileId: teacherProfile.id,
    schoolYearId: (await db.historicalClassInstance.findUnique({
      where: { id: instanceId },
      select: { schoolYearId: true },
    }))!.schoolYearId,
    actorId: session.user.id,
    ip,
    userAgent,
  })

  await auditGradeChange({
    actorId: session.user.id,
    actorRole: session.user.role,
    studentProfileId: studentId,
    historicalClassInstanceId: instanceId,
    standardNumber,
    before,
    after: { score, feedback },
    ipAddress: ip,
    userAgent,
  })

  return NextResponse.json({ data: { assessment } })
}

// ---------------------------------------------------------------------------
// Grade snapshot recalculation helper
// ---------------------------------------------------------------------------

async function recalculateSnapshot(opts: {
  studentProfileId: string
  instanceId: string
  teacherProfileId: string
  schoolYearId: string
  actorId: string
  ip: string
  userAgent?: string
}): Promise<void> {
  try {
    const assessments = await db.teacherAssessment.findMany({
      where: {
        historicalClassInstanceId: opts.instanceId,
        studentProfileId: opts.studentProfileId,
      },
      select: { standardNumber: true, score: true },
    })

    const byStd = new Map(assessments.map((a) => [a.standardNumber, a.score != null ? Number(a.score) : null]))

    const s1 = byStd.get(1) ?? null
    const s2 = byStd.get(2) ?? null
    const s3 = byStd.get(3) ?? null
    const s4 = byStd.get(4) ?? null

    let overallAverage: number | null = null
    let letterGrade: string | null = null

    if (s1 !== null && s2 !== null && s3 !== null && s4 !== null) {
      try {
        const i1 = standardScoreToInternal(s1)
        const i2 = standardScoreToInternal(s2)
        const i3 = standardScoreToInternal(s3)
        const i4 = standardScoreToInternal(s4)
        overallAverage = (i1 + i2 + i3 + i4) / 4
        letterGrade = internalAverageToLetterGrade(overallAverage)
      } catch {
        // Score not in valid set yet — skip
      }
    }

    const snapshot = await db.gradeCalculationSnapshot.create({
      data: {
        studentProfileId: opts.studentProfileId,
        historicalClassInstanceId: opts.instanceId,
        schoolYearId: opts.schoolYearId,
        standard1Score: s1,
        standard2Score: s2,
        standard3Score: s3,
        standard4Score: s4,
        overallAverage,
        letterGrade,
        snapshotData: { assessments: Object.fromEntries(byStd) },
      },
    })

    await auditGradeSnapshot({
      actorId: opts.actorId,
      studentProfileId: opts.studentProfileId,
      historicalClassInstanceId: opts.instanceId,
      snapshotId: snapshot.id,
      ipAddress: opts.ip,
      userAgent: opts.userAgent,
    })
  } catch (err) {
    console.error('[snapshot] Failed to recalculate grade snapshot:', err)
  }
}
