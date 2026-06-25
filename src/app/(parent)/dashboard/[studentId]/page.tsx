import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect, notFound } from 'next/navigation'
import { GradeCard } from '@/components/student/GradeCard'
import { StandardCard } from '@/components/student/StandardCard'
import { FeedbackCard } from '@/components/student/FeedbackCard'
import { RotationTimeline } from '@/components/student/RotationTimeline'
import { StudentSwitcher } from '@/components/parent/StudentSwitcher'
import type { ColorDistribution } from '@/components/student/ColorDonut'

export const metadata: Metadata = { title: 'Student Grades — MICDS PE' }

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

interface Props {
  params: Promise<{ studentId: string }>
}

export default async function ParentStudentDashboard({ params }: Props) {
  const { studentId } = await params
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'PARENT') redirect('/unauthorized')

  // Verify parent-student link
  const parentProfile = await db.parentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!parentProfile) redirect('/unauthorized')

  const link = await db.parentStudentLink.findFirst({
    where: { parentProfileId: parentProfile.id, studentProfileId: studentId },
  })
  if (!link) return notFound()

  // All linked students (for switcher)
  const allLinks = await db.parentStudentLink.findMany({
    where: { parentProfileId: parentProfile.id },
    include: {
      studentProfile: {
        select: { id: true, firstName: true, lastName: true, gradeLevel: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  const students = allLinks.map((l) => l.studentProfile)

  const student = students.find((s) => s.id === studentId)
  if (!student) return notFound()

  // Load student data
  const membership = await db.studentGroupMembership.findFirst({
    where: { studentProfileId: studentId, leftAt: null },
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
  const teacherName = tca?.teacherProfile
    ? `${tca.teacherProfile.firstName} ${tca.teacherProfile.lastName}`
    : undefined

  const currentSnapshot = currentInstance
    ? await db.gradeCalculationSnapshot.findFirst({
        where: { studentProfileId: studentId, historicalClassInstanceId: currentInstance.id },
        orderBy: { calculatedAt: 'desc' },
      })
    : null

  const visibleFeedback = currentInstance
    ? await db.teacherAssessment.findMany({
        where: {
          studentProfileId: studentId,
          historicalClassInstanceId: currentInstance.id,
          isFeedbackStudentVisible: true,
          feedback: { not: null },
        },
        select: { standardNumber: true, feedback: true, score: true, assessedAt: true },
      })
    : []

  const skillAssessments = currentInstance
    ? await db.teacherAssessment.findMany({
        where: { studentProfileId: studentId, historicalClassInstanceId: currentInstance.id },
        select: { standardNumber: true, teacherSkillScores: { select: { score: true } } },
      })
    : []

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
                where: { studentProfileId: studentId },
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

  const std1 = skillAssessments.filter((a) => a.standardNumber === 1).flatMap((a) => a.teacherSkillScores.map((s) => s.score))
  const std2 = skillAssessments.filter((a) => a.standardNumber === 2).flatMap((a) => a.teacherSkillScores.map((s) => s.score))
  const std3 = skillAssessments.filter((a) => a.standardNumber === 3).flatMap((a) => a.teacherSkillScores.map((s) => s.score))
  const std4 = skillAssessments.filter((a) => a.standardNumber === 4).flatMap((a) => a.teacherSkillScores.map((s) => s.score))

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Parent Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Read-only view of your child's PE grades</p>
      </div>

      <StudentSwitcher
        students={students}
        activeStudentId={studentId}
        baseHref="/parent/dashboard"
      />

      <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 text-sm text-violet-700">
        Viewing <strong>{student.firstName} {student.lastName}</strong>'s grades
        {group && ` · ${group.name}`}
        {student.gradeLevel && ` · Grade ${student.gradeLevel.replace('GRADE_', '')}`}
      </div>

      {currentSnapshot ? (
        <GradeCard
          letterGrade={currentSnapshot.letterGrade ?? undefined}
          overallAverage={currentSnapshot.overallAverage ?? undefined}
          activityName={activityName}
          teacherName={teacherName}
        />
      ) : (
        <div className="rounded-2xl bg-slate-100 p-6 flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center text-3xl font-black text-slate-300">—</div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-1">Current Overall Grade</p>
            <p className="text-slate-500 text-sm">No grades recorded yet for this rotation.</p>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Standards</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StandardCard standardNumber={1} name="Movement Skills" score={currentSnapshot?.standard1Score ?? null} distribution={buildDistribution(std1)} />
          <StandardCard standardNumber={2} name="Movement Concepts & Sport Strategies" score={currentSnapshot?.standard2Score ?? null} distribution={buildDistribution(std2)} />
          <StandardCard standardNumber={3} name="Health, Fitness & Nutrition" score={currentSnapshot?.standard3Score ?? null} distribution={buildDistribution(std3)} />
          <StandardCard standardNumber={4} name="Teamwork & Leadership" score={currentSnapshot?.standard4Score ?? null} distribution={buildDistribution(std4)} />
        </div>
      </div>

      <FeedbackCard
        items={visibleFeedback.map((f) => ({
          standardNumber: f.standardNumber,
          feedback: f.feedback,
          score: f.score,
          assessedAt: f.assessedAt,
        }))}
      />

      <RotationTimeline
        rotations={timelineEntries}
        currentInstanceId={currentInstance?.id}
      />
    </div>
  )
}
