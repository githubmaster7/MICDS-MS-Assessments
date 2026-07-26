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

export const metadata: Metadata = { title: 'Parent Dashboard' }

const STATUS_META: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'bg-primary-50 text-primary-900 border-primary-100' },
  COMPLETED: { label: 'Completed', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  LOCKED: { label: 'Locked', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  UPCOMING: { label: 'Upcoming', className: 'bg-gray-50 text-gray-500 border-gray-200' },
}

export default async function ParentDashboard({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const { studentId: qStudentId } = await searchParams

  const parent = await db.parentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      studentLinks: {
        include: {
          studentProfile: {
            include: {
              groupMemberships: {
                where: { leftAt: null },
                include: { studentGroup: true },
              },
            },
          },
        },
      },
    },
  })

  if (!parent || parent.studentLinks.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <h2 className="font-semibold text-yellow-800 mb-1">No Students Linked</h2>
          <p className="text-yellow-700 text-sm">No student accounts are linked to your parent profile. Contact the school administrator.</p>
        </div>
      </div>
    )
  }

  const students = parent.studentLinks.map((l) => l.studentProfile)
  const activeStudentId = qStudentId ?? students[0]?.id
  const student = students.find((s) => s.id === activeStudentId) ?? students[0]

  if (!student) return null

  // The student's actual current class is whichever rotation is ACTIVE right
  // now — used below purely for "which class is this student in right now"
  // display, not for the grade itself.
  const activeGroupId = student.groupMemberships[0]?.studentGroupId
  const activeInstance = activeGroupId
    ? await db.historicalClassInstance.findFirst({
        where: { studentGroupId: activeGroupId, status: 'ACTIVE' },
        include: {
          teacherClassAssignment: {
            include: { activityTemplate: true, teacherProfile: true },
          },
        },
      })
    : null

  const currentActivity = activeInstance?.teacherClassAssignment
  const currentTeacher = currentActivity?.teacherProfile

  // Full class history — every rotation this student's group has ever been
  // scheduled into, past and future, mirroring the student's own "My
  // Classes" page but scoped to the selected child and linking to the
  // parent's read-only class detail view instead.
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

  const historySnapshots = await db.gradeCalculationSnapshot.findMany({
    where: { studentProfileId: student.id, historicalClassInstanceId: { in: instances.map((i) => i.id) } },
    orderBy: { calculatedAt: 'desc' },
    select: { historicalClassInstanceId: true, letterGrade: true },
  })
  const latestSnapshotByInstance = new Map<string, (typeof historySnapshots)[number]>()
  for (const s of historySnapshots) {
    if (!latestSnapshotByInstance.has(s.historicalClassInstanceId)) {
      latestSnapshotByInstance.set(s.historicalClassInstanceId, s)
    }
  }

  const historyRows = [
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
      href: `/parent/class/${inst.id}?studentId=${student.id}` as string | null,
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

  // Overall Grade is cumulative — every score pooled across every class this
  // student has been in this year (the same numbers behind the "Score
  // Distribution — All Classes" chart below), NOT just whichever class most
  // recently had a grade calculated. Each individual class still shows its
  // own isolated grade in "Class History" below.
  const standardAverages = {
    s1: averageFromBuckets(scoreDistribution[1]),
    s2: averageFromBuckets(scoreDistribution[2]),
    s3: averageFromBuckets(scoreDistribution[3]),
    s4: averageFromBuckets(scoreDistribution[4]),
  }
  const cumulative = calculateCumulativeGrade(standardAverages)
  const grade = cumulative?.letterGrade

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader
        variant="primary"
        title="Parent Dashboard"
        description="Read-only view"
        actions={
          students.length > 1 && (
            <div className="flex gap-2">
              {students.map((s) => (
                <a
                  key={s.id}
                  href={`/parent/dashboard?studentId=${s.id}`}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${s.id === student.id ? 'bg-primary-700 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-primary-300'}`}
                >
                  {s.firstName} {s.lastName}
                </a>
              ))}
            </div>
          )
        }
      />

      <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 mb-6 text-sm text-primary-900">
        <strong>Viewing:</strong> {student.firstName} {student.lastName} · Grade {student.gradeLevel.replace('GRADE_', '')} · {student.groupMemberships[0]?.studentGroup.name ?? 'No group'}
      </div>

      <div className="bg-primary-700 text-role-fg rounded-2xl p-6 mb-6 flex items-center gap-6">
        <div className="text-center">
          <div className="text-6xl font-black">{grade ?? '—'}</div>
          <div className="text-sm text-role-fg/80 mt-1">Overall Grade</div>
        </div>
        <div className="flex-1">
          {currentActivity && (
            <div>
              <div className="font-semibold">{currentActivity.activityTemplate.name}</div>
              <div className="text-role-fg/80 text-sm">
                {currentTeacher ? `${currentTeacher.firstName} ${currentTeacher.lastName}` : 'No teacher assigned'}
              </div>
            </div>
          )}
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Std 1', score: standardAverages.s1 },
              { label: 'Std 2', score: standardAverages.s2 },
              { label: 'Std 3', score: standardAverages.s3 },
              { label: 'Std 4', score: standardAverages.s4 },
            ].map(({ label, score }) => (
              <div key={label} className="bg-role-fg/10 rounded-lg p-2">
                <div className="text-xs text-role-fg/70">{label}</div>
                <div className="text-lg font-bold">{score != null ? score.toFixed(2) : '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-semibold text-gray-900 mb-1">Score Distribution — All Classes</h2>
        <p className="text-xs text-gray-400 mb-4">
          Every score {student.firstName}&apos;s teachers have given, by standard, pooled across all classes.
          Hover a slice (or a legend row) to see which classes contributed it.
        </p>
        <StandardDistributionGrid distribution={scoreDistribution} />
      </div>

      <div className="mb-6">
        <h2 className="font-semibold text-gray-900 mb-1">Approach to Learning</h2>
        <p className="text-xs text-gray-400 mb-4">
          Teachers&apos; ratings of classroom habits, pooled across all classes. Informational only — does not affect the letter grade.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-primary-200 p-4">
            <ScoreDistributionChart buckets={atlDistribution.responsiblePrepared} title="Responsible & Prepared for Class" />
          </div>
          <div className="bg-white rounded-xl border border-primary-200 p-4">
            <ScoreDistributionChart buckets={atlDistribution.respectfulWorks} title="Respectful and Works Well with Others" />
          </div>
          <div className="bg-white rounded-xl border border-primary-200 p-4">
            <ScoreDistributionChart buckets={atlDistribution.effortTeacherScore} title="Puts Forth Effort to Learn" />
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-gray-900 mb-1">Class History</h2>
        <p className="text-xs text-gray-400 mb-4">
          Open a class to see {student.firstName}&apos;s own answers and comments alongside the teacher&apos;s score and feedback.
        </p>
        {historyRows.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
            No classes scheduled yet.
          </div>
        ) : (
          <div className="space-y-3">
            {historyRows.map((row) => {
              const meta = STATUS_META[row.status] ?? STATUS_META.UPCOMING
              const content = (
                <div className="bg-white rounded-xl border border-primary-200 p-4 flex items-center justify-between gap-4 hover:border-primary-400 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400 tabular-nums">Class {row.rotationNumber}</span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-900">{row.activity}</h3>
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
    </div>
  )
}
