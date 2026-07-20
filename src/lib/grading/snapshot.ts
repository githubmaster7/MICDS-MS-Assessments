import type { Prisma, PrismaClient } from '@prisma/client'
import { standardScoreToInternal, internalAverageToLetterGrade } from '@/lib/grading/conversion'

type DbClient = PrismaClient | Prisma.TransactionClient

/**
 * Computes and persists a GradeCalculationSnapshot from a student's current
 * TeacherAssessment rows for a class instance. Shared by the teacher grading
 * route (called on every score edit) and the rotation route (called once per
 * student when their class locks, so history reflects grades as they stood
 * at that moment rather than a possibly-stale or missing snapshot).
 */
export async function createGradeSnapshot(
  db: DbClient,
  opts: { studentProfileId: string; historicalClassInstanceId: string; schoolYearId: string },
) {
  const assessments = await db.teacherAssessment.findMany({
    where: {
      historicalClassInstanceId: opts.historicalClassInstanceId,
      studentProfileId: opts.studentProfileId,
    },
    select: { standardNumber: true, score: true },
  })

  const byStd = new Map<number, number | null>(
    assessments.map((a: { standardNumber: number; score: unknown }) => [
      a.standardNumber,
      a.score != null ? Number(a.score) : null,
    ]),
  )

  const s1 = byStd.get(1) ?? null
  const s2 = byStd.get(2) ?? null
  const s3 = byStd.get(3) ?? null
  const s4 = byStd.get(4) ?? null

  // Approach to Learning is informational only and does not factor into the
  // overall average or letter grade (see grading/README docs).
  const atlRecord = await db.approachToLearningRecord.findUnique({
    where: {
      studentProfileId_historicalClassInstanceId: {
        studentProfileId: opts.studentProfileId,
        historicalClassInstanceId: opts.historicalClassInstanceId,
      },
    },
    select: { calculatedScore: true },
  })
  const atlScore = atlRecord?.calculatedScore != null ? Number(atlRecord.calculatedScore) : null

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

  return db.gradeCalculationSnapshot.create({
    data: {
      studentProfileId: opts.studentProfileId,
      historicalClassInstanceId: opts.historicalClassInstanceId,
      schoolYearId: opts.schoolYearId,
      standard1Score: s1,
      standard2Score: s2,
      standard3Score: s3,
      standard4Score: s4,
      atlScore,
      overallAverage,
      letterGrade,
      snapshotData: { assessments: Object.fromEntries(byStd) },
    },
  })
}
