import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { GradeCard } from '@/components/student/GradeCard'
import { StandardCard } from '@/components/student/StandardCard'
import { FeedbackCard } from '@/components/student/FeedbackCard'
import { RotationTimeline } from '@/components/student/RotationTimeline'
import { StudentSwitcher } from '@/components/parent/StudentSwitcher'
import type { ColorDistribution } from '@/components/student/ColorDonut'

export const metadata: Metadata = { title: 'Parent Dashboard — MICDS PE' }

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

export default async function ParentDashboard({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'PARENT') redirect('/unauthorized')

  const parentProfile = await db.parentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!parentProfile) redirect('/unauthorized')

  // Get all linked students
  const links = await db.parentStudentLink.findMany({
    where: { parentProfileId: parentProfile.id },
    include: {
      studentProfile: {
        select: { id: true, firstName: true, lastName: true, gradeLevel: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const students = links.map((l) => l.studentProfile)

  if (students.length === 0) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto">
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-8 text-center">
          <p className="text-3xl mb-3" aria-hidden="true">👨‍👩‍👧</p>
          <p className="font-semibold text-amber-800">No Students Linked</p>
          <p className="text-sm text-amber-700 mt-1">
            No student accounts are linked to your parent profile. Contact the school administrator.
          </p>
        </div>
      </div>
    )
  }

  const { studentId } = await searchParams
  const activeStudent = students.find((s) => s.id === studentId) ?? students[0]!

  // Load data for active student
  const membership = await db.studentGroupMembership.findFirst({
    where: { studentProfileId: activeStudent.id, leftAt: null },
    include: {
      studentGroup: {
        select: {
          id: true,
          name: true,
          groupRotationAssignments: {
            where: { status: { in: ['ACTIVE'] } },
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
                take: 1,
                orderBy: { createdAt: 'desc' },
                select: { id: true, status: true },
              },
            },
          },
        },
      },
    },
  })

  const group = membership?.studentGroup
  const activeRotation = group?.groupRotationAssignments[0] ?? null
  const currentInstance = activeRotation?.historicalClassInstances[0] ?? null
  const tca = activeRotation?.carouselPosition?.teacherClassAssignment
  const activityName = tca?.activityTemplate?.name
  const teacher = tca?.teacherProfile
  const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : undefined

  const currentSnapshot = currentInstance
    ? await db.gradeCalculationSnapshot.findFirst({
        where: {
          studentProfileId: activeStudent.id,
          historicalClassInstanceId: currentInstance.id,
        },
        orderBy: { calculatedAt: 'desc' },
      })
    : null

  const visibleFeedback = currentInstance
    ? await db.teacherAssessment.findMany({
        where: {
          studentProfileId: activeStudent.id,
          historicalClassInstanceId: currentInstance.id,
          isFeedbackStudentVisible: true,
          feedback: { not: null },
        },
        select: { standardNumber: true, feedback: true, score: true, assessedAt: true },
      })
    : []

  const teacherAssessments = currentInstance
    ? await db.teacherAssessment.findMany({
        where: {
          studentProfileId: activeStudent.id,
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
                where: { studentProfileId: activeStudent.id },
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

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900">Parent Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Read-only view of your child's PE grades</p>
      </div>

      {/* Student switcher */}
      <StudentSwitcher
        students={students}
        activeStudentId={activeStudent.id}
        baseHref="/parent/dashboard"
      />

      {/* Viewing banner */}
      <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 text-sm text-violet-700">
        Viewing <strong>{activeStudent.firstName} {activeStudent.lastName}</strong>'s grades
        {group && ` · ${group.name}`}
        {activeStudent.gradeLevel && ` · Grade ${activeStudent.gradeLevel.replace('GRADE_', '')}`}
      </div>

      {/* Grade hero */}
      {currentSnapshot ? (
        <GradeCard
          letterGrade={currentSnapshot.letterGrade ?? undefined}
          overallAverage={currentSnapshot.overallAverage ?? undefined}
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
                ? 'No grades recorded yet for this rotation.'
                : 'No active class assigned.'}
            </p>
          </div>
        </div>
      )}

      {/* Standard scores */}
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
          />
          <StandardCard
            standardNumber={2}
            name="Movement Concepts & Sport Strategies"
            score={currentSnapshot?.standard2Score ?? null}
            distribution={buildDistribution(std2Scores)}
          />
          <StandardCard
            standardNumber={3}
            name="Health, Fitness & Nutrition"
            score={currentSnapshot?.standard3Score ?? null}
            distribution={buildDistribution(std3Scores)}
          />
          <StandardCard
            standardNumber={4}
            name="Teamwork & Leadership"
            score={currentSnapshot?.standard4Score ?? null}
            distribution={buildDistribution(std4Scores)}
          />
        </div>
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
