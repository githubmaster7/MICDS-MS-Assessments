import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { GradeCard } from '@/components/student/GradeCard'
import { StandardCard } from '@/components/student/StandardCard'
import { FeedbackCard } from '@/components/student/FeedbackCard'
import { RotationTimeline } from '@/components/student/RotationTimeline'
import type { ColorDistribution } from '@/components/student/ColorDonut'
import Link from 'next/link'

export const metadata: Metadata = { title: 'My Dashboard — MICDS PE' }

// Build color distribution from skill scores for a standard
function buildDistribution(scores: number[]): ColorDistribution {
  const dist: ColorDistribution = { red: 0, yellow: 0, lightgreen: 0, brightgreen: 0 }
  for (const s of scores) {
    if (s >= 4) dist.brightgreen++
    else if (s >= 3) dist.lightgreen++
    else if (s >= 2) dist.yellow++
    else dist.red++
  }
  return dist
}

function gradeEncouragement(grade: string | null | undefined): string {
  if (!grade) return 'Your teacher is still grading — check back soon!'
  if (grade.startsWith('A')) return 'Incredible work this rotation!'
  if (grade.startsWith('B')) return 'Strong effort — keep pushing!'
  if (grade.startsWith('C')) return 'You\'re making progress. Stay consistent!'
  return 'Talk to your teacher about how to improve.'
}

export default async function StudentDashboard() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'STUDENT') redirect('/unauthorized')

  const student = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gradeLevel: true,
      groupMemberships: {
        where: { leftAt: null },
        take: 1,
        include: {
          studentGroup: {
            select: {
              id: true,
              name: true,
              groupRotationAssignments: {
                where: {
                  status: { in: ['ACTIVE', 'UPCOMING'] },
                },
                orderBy: { rotationNumber: 'asc' },
                take: 1,
                include: {
                  carouselPosition: {
                    include: {
                      teacherClassAssignment: {
                        include: {
                          activityTemplate: { select: { name: true } },
                          teacherProfile: { select: { firstName: true, lastName: true } },
                        },
                      },
                    },
                  },
                  historicalClassInstances: {
                    where: { status: { not: 'LOCKED' } },
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, status: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!student) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-8 text-center">
          <p className="text-lg font-semibold text-amber-800 mb-2">Profile Not Set Up</p>
          <p className="text-sm text-amber-700">
            Your student profile hasn't been created yet. Contact your PE teacher or administrator.
          </p>
        </div>
      </div>
    )
  }

  const membership = student.groupMemberships[0]
  const group = membership?.studentGroup
  const activeRotation = group?.groupRotationAssignments[0] ?? null
  const currentInstance = activeRotation?.historicalClassInstances[0] ?? null
  const tca = activeRotation?.carouselPosition?.teacherClassAssignment
  const activityName = tca?.activityTemplate?.name
  const teacher = tca?.teacherProfile
  const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : undefined

  // Latest grade snapshot for current instance
  const currentSnapshot = currentInstance
    ? await db.gradeCalculationSnapshot.findFirst({
        where: {
          studentProfileId: student.id,
          historicalClassInstanceId: currentInstance.id,
        },
        orderBy: { calculatedAt: 'desc' },
      })
    : null

  // ATL data
  const atlAssessment = currentInstance
    ? await db.approachToLearningRecord.findFirst({
        where: {
          studentProfileId: student.id,
          historicalClassInstanceId: currentInstance.id,
        },
        orderBy: { recordedAt: 'desc' },
      })
    : null

  // Visible teacher feedback for current instance
  const visibleFeedback = currentInstance
    ? await db.teacherAssessment.findMany({
        where: {
          studentProfileId: student.id,
          historicalClassInstanceId: currentInstance.id,
          isFeedbackStudentVisible: true,
          feedback: { not: null },
        },
        select: {
          standardNumber: true,
          feedback: true,
          score: true,
          assessedAt: true,
        },
      })
    : []

  // Teacher skill scores for donut charts — pulled from TeacherAssessment > TeacherSkillScore
  const teacherAssessments = currentInstance
    ? await db.teacherAssessment.findMany({
        where: {
          studentProfileId: student.id,
          historicalClassInstanceId: currentInstance.id,
        },
        select: {
          standardNumber: true,
          teacherSkillScores: { select: { score: true } },
        },
      })
    : []

  function scoresForStd(stdNum: number): number[] {
    return teacherAssessments
      .filter((a) => a.standardNumber === stdNum)
      .flatMap((a) => a.teacherSkillScores.map((s) => s.score))
  }

  const std1Scores = scoresForStd(1)
  const std2Scores = scoresForStd(2)
  const std3Scores = scoresForStd(3)
  const std4Scores = scoresForStd(4)

  // All rotations for timeline
  const allAssignments = group
    ? await db.groupRotationAssignment.findMany({
        where: { studentGroupId: group.id },
        orderBy: { rotationNumber: 'asc' },
        include: {
          carouselPosition: {
            include: {
              teacherClassAssignment: {
                include: {
                  activityTemplate: { select: { name: true } },
                  teacherProfile: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
          historicalClassInstances: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              gradeSnapshots: {
                where: { studentProfileId: student.id },
                orderBy: { calculatedAt: 'desc' },
                take: 1,
                select: { letterGrade: true },
              },
            },
          },
        },
      })
    : []

  const timelineEntries = allAssignments.map((a) => {
    const tca2 = a.carouselPosition?.teacherClassAssignment
    const inst = a.historicalClassInstances[0]
    const snap = inst?.gradeSnapshots[0]
    return {
      instanceId: inst?.id,
      rotationNumber: a.rotationNumber,
      activityName: tca2?.activityTemplate?.name ?? 'Unknown Activity',
      teacherName: tca2?.teacherProfile
        ? `${tca2.teacherProfile.firstName} ${tca2.teacherProfile.lastName}`
        : undefined,
      letterGrade: snap?.letterGrade ?? null,
      status: a.status,
      startDate: a.startDate,
      endDate: a.endDate,
    }
  })

  const grade = currentSnapshot?.letterGrade
  const encouragement = gradeEncouragement(grade)

  // ATL display
  const atlDaysLateUnprepared = atlAssessment?.daysLateUnprepared ?? 0
  const atlScore = atlAssessment?.calculatedScore ?? null
  const atlScoreNum = atlScore != null ? Number(atlScore) : null
  const atlColor =
    atlScoreNum == null
      ? 'text-slate-400'
      : atlScoreNum >= 90
      ? 'text-emerald-600'
      : atlScoreNum >= 75
      ? 'text-amber-600'
      : 'text-red-600'

  const isComplete =
    currentSnapshot != null &&
    currentSnapshot.standard1Score != null &&
    currentSnapshot.standard2Score != null

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">
          Welcome back, {student.firstName}!
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {group?.name ?? 'No group assigned'}
          {activityName && ` · ${activityName}`}
          {teacherName && ` · ${teacherName}`}
        </p>
      </div>

      {/* Grade hero */}
      {currentSnapshot || grade ? (
        <GradeCard
          letterGrade={grade}
          overallAverage={currentSnapshot?.overallAverage ?? undefined}
          activityName={activityName}
          teacherName={teacherName}
        />
      ) : (
        <div className="rounded-2xl bg-slate-100 p-6 flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center text-3xl font-black text-slate-300">
            —
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-1">
              Current Overall Grade
            </p>
            <p className="text-slate-500 text-sm">
              {activityName
                ? 'Your teacher hasn\'t graded this rotation yet.'
                : 'No active class assigned.'}
            </p>
          </div>
        </div>
      )}

      {/* Submit work CTA */}
      {currentInstance && activeRotation?.status === 'ACTIVE' && (
        <Link
          href={`/student/submit/${currentInstance.id}`}
          className="flex items-center justify-between rounded-2xl bg-blue-600 text-white px-5 py-4 hover:bg-blue-700 transition-colors shadow-sm"
        >
          <div>
            <p className="font-semibold">Submit Your Work</p>
            <p className="text-blue-200 text-sm mt-0.5">{activityName} — written responses due</p>
          </div>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7 10h6M10 7l3 3-3 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      )}

      {/* Standard score cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Standards
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StandardCard
            standardNumber={1}
            name="Movement Skills"
            score={currentSnapshot?.standard1Score ?? null}
            distribution={buildDistribution(std1Scores)}
            isComplete={isComplete}
          />
          <StandardCard
            standardNumber={2}
            name="Movement Concepts & Sport Strategies"
            score={currentSnapshot?.standard2Score ?? null}
            distribution={buildDistribution(std2Scores)}
            isComplete={isComplete}
          />
          <StandardCard
            standardNumber={3}
            name="Health, Fitness & Nutrition"
            score={currentSnapshot?.standard3Score ?? null}
            distribution={buildDistribution(std3Scores)}
            isComplete={isComplete}
          />
          <StandardCard
            standardNumber={4}
            name="Teamwork & Leadership"
            score={currentSnapshot?.standard4Score ?? null}
            distribution={buildDistribution(std4Scores)}
            isComplete={isComplete}
          />
        </div>
      </div>

      {/* Approach to Learning */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
        <h2 className="font-semibold text-slate-800 mb-3">Approach to Learning</h2>
        {atlAssessment ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-2xl font-black tabular-nums text-slate-800">{atlDaysLateUnprepared}</p>
              <p className="text-xs text-slate-400 mt-0.5">Days Late / Unprepared</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-black tabular-nums ${atlColor}`}>
                {atlScore != null ? `${Number(atlScore).toFixed(0)}%` : '—'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">ATL Score</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-2">
            No Approach to Learning data recorded yet.
          </p>
        )}
      </div>

      {/* Teacher feedback */}
      <FeedbackCard
        items={visibleFeedback.map((f) => ({
          standardNumber: f.standardNumber,
          feedback: f.feedback,
          score: f.score,
          assessedAt: f.assessedAt,
        }))}
      />

      {/* Rotation timeline */}
      <RotationTimeline
        rotations={timelineEntries}
        currentInstanceId={currentInstance?.id}
      />
    </div>
  )
}
