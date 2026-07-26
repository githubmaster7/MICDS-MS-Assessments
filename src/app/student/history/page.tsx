import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { RotationStatus } from '@prisma/client'
import Link from 'next/link'
import { getStudentStandardItemDistribution, getStudentApproachToLearningDistribution, averageFromBuckets } from '@/lib/analytics/score-distribution'
import { StandardDistributionGrid, ScoreDistributionChart } from '@/components/student/ScoreDistributionChart'
import { calculateCumulativeGrade } from '@/lib/grading/conversion'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata: Metadata = { title: 'My Classes' }

const STATUS_META: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'bg-primary-50 text-primary-900 border-primary-100' },
  COMPLETED: { label: 'Completed', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  LOCKED: { label: 'Locked', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  UPCOMING: { label: 'Upcoming', className: 'bg-gray-50 text-gray-500 border-gray-200' },
}

export default async function StudentHistoryPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const student = await db.studentProfile.findUnique({ where: { userId: session.user.id } })
  if (!student) return <div className="p-6 text-gray-500">Student profile not found.</div>

  const memberships = await db.studentGroupMembership.findMany({
    where: { studentProfileId: student.id },
    select: { studentGroupId: true },
  })
  const groupIds = [...new Set(memberships.map((m) => m.studentGroupId))]

  const instances = await db.historicalClassInstance.findMany({
    where: { studentGroupId: { in: groupIds } },
    include: {
      studentGroup: { select: { name: true } },
      teacherClassAssignment: {
        include: {
          activityTemplate: { select: { name: true } },
          teacherProfile: { select: { firstName: true, lastName: true } },
        },
      },
      groupRotationAssignment: { select: { rotationNumber: true, startDate: true, endDate: true } },
    },
    orderBy: { groupRotationAssignment: { rotationNumber: 'asc' } },
  })

  // Upcoming rotations don't have a HistoricalClassInstance yet — show them
  // as N/A so students can see their whole year, not just what's happened.
  const upcomingRotations = await db.groupRotationAssignment.findMany({
    where: { studentGroupId: { in: groupIds }, status: RotationStatus.UPCOMING },
    include: {
      studentGroup: { select: { name: true } },
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
    },
    orderBy: { rotationNumber: 'asc' },
  })

  const snapshots = await db.gradeCalculationSnapshot.findMany({
    where: {
      studentProfileId: student.id,
      historicalClassInstanceId: { in: instances.map((i) => i.id) },
    },
    orderBy: { calculatedAt: 'desc' },
    select: { historicalClassInstanceId: true, letterGrade: true, overallAverage: true },
  })
  const latestSnapshotByInstance = new Map<string, (typeof snapshots)[number]>()
  for (const s of snapshots) {
    if (!latestSnapshotByInstance.has(s.historicalClassInstanceId)) {
      latestSnapshotByInstance.set(s.historicalClassInstanceId, s)
    }
  }

  const rows = [
    ...instances.map((inst) => ({
      id: inst.id,
      rotationNumber: inst.groupRotationAssignment.rotationNumber,
      activity: inst.teacherClassAssignment.activityTemplate.name,
      teacher: `${inst.teacherClassAssignment.teacherProfile.firstName} ${inst.teacherClassAssignment.teacherProfile.lastName}`,
      group: inst.studentGroup.name,
      startDate: inst.groupRotationAssignment.startDate,
      endDate: inst.groupRotationAssignment.endDate,
      status: inst.status as string,
      letterGrade: latestSnapshotByInstance.get(inst.id)?.letterGrade ?? null,
      href: `/student/class/${inst.id}` as string | null,
    })),
    ...upcomingRotations.map((rot) => ({
      id: rot.id,
      rotationNumber: rot.rotationNumber,
      activity: rot.carouselPosition.teacherClassAssignment.activityTemplate.name,
      teacher: `${rot.carouselPosition.teacherClassAssignment.teacherProfile.firstName} ${rot.carouselPosition.teacherClassAssignment.teacherProfile.lastName}`,
      group: rot.studentGroup.name,
      startDate: rot.startDate,
      endDate: rot.endDate,
      status: 'UPCOMING',
      letterGrade: null as string | null,
      href: null,
    })),
  ].sort((a, b) => a.rotationNumber - b.rotationNumber)

  const scoreDistribution = await getStudentStandardItemDistribution(student.id)
  const atlDistribution = await getStudentApproachToLearningDistribution(student.id)

  // Same cumulative grade the dashboard hero shows — derived from the exact
  // same pooled item distribution as the Score Distribution chart below, so
  // this badge and that chart can never disagree with each other. This is
  // deliberately NOT any single class's own grade (each class's own grade is
  // shown per-row below instead) — it's the average across every class.
  const cumulativeGrade = calculateCumulativeGrade({
    s1: averageFromBuckets(scoreDistribution[1]),
    s2: averageFromBuckets(scoreDistribution[2]),
    s3: averageFromBuckets(scoreDistribution[3]),
    s4: averageFromBuckets(scoreDistribution[4]),
  })
  const currentLetterGrade = cumulativeGrade?.letterGrade ?? null

  const gradeColorClass: Record<string, string> = {
    A: 'bg-emerald-600', 'A-': 'bg-emerald-500',
    'B+': 'bg-blue-600', B: 'bg-blue-500', 'B-': 'bg-blue-400',
    'C+': 'bg-yellow-500', C: 'bg-yellow-400', 'C-': 'bg-orange-500',
    'D+': 'bg-orange-600', D: 'bg-red-500', 'D-': 'bg-red-600', F: 'bg-red-700',
  }

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader
        title="My Classes"
        description="Your class history for the current school year. Scores are final once a class is completed."
      />

      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-gray-900">Score Distribution — All Classes</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Overall grade</span>
            <span
              className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold ${currentLetterGrade ? gradeColorClass[currentLetterGrade] ?? 'bg-gray-400' : 'bg-gray-300'}`}
            >
              {currentLetterGrade ?? '—'}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Every score your teachers have given you, by standard, pooled across all your classes.
          Hover a slice (or a legend row) to see which classes contributed it.
        </p>
        <StandardDistributionGrid distribution={scoreDistribution} />
      </div>

      <div className="mb-6">
        <h2 className="font-semibold text-gray-900 mb-1">Approach to Learning</h2>
        <p className="text-xs text-gray-400 mb-4">
          Your teachers&apos; ratings of your classroom habits, pooled across all your classes.
          Informational only — does not affect your letter grade.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <ScoreDistributionChart buckets={atlDistribution.responsiblePrepared} title="Responsible & Prepared for Class" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <ScoreDistributionChart buckets={atlDistribution.respectfulWorks} title="Respectful and Works Well with Others" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <ScoreDistributionChart buckets={atlDistribution.effortTeacherScore} title="Puts Forth Effort to Learn" />
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
          No classes scheduled yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const meta = STATUS_META[row.status] ?? STATUS_META.UPCOMING
            const content = (
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4 hover:border-primary-300 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400 tabular-nums">Class {row.rotationNumber}</span>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
                      {meta.label}
                    </span>
                  </div>
                  <h2 className="font-semibold text-gray-900">{row.activity}</h2>
                  <p className="text-sm text-gray-500">
                    {row.teacher} · {row.group}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(row.startDate)} – {formatDate(row.endDate)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {row.letterGrade ? (
                    <div className="text-2xl font-bold text-gray-900">{row.letterGrade}</div>
                  ) : (
                    <div className="text-sm text-gray-300">
                      {row.status === 'UPCOMING' ? 'N/A' : 'No grade yet'}
                    </div>
                  )}
                </div>
              </div>
            )
            return row.href ? (
              <Link key={row.id} href={row.href}>
                {content}
              </Link>
            ) : (
              <div key={row.id}>{content}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}
