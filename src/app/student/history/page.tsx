import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { RotationStatus } from '@prisma/client'
import Link from 'next/link'
import { getStudentStandardItemDistribution, getStudentApproachToLearningDistribution } from '@/lib/analytics/score-distribution'
import { StandardDistributionGrid, ScoreDistributionChart } from '@/components/student/ScoreDistributionChart'

export const metadata: Metadata = { title: 'My Classes' }

const STATUS_META: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'bg-blue-50 text-blue-700 border-blue-100' },
  COMPLETED: { label: 'Completed', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  LOCKED: { label: 'Locked', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  UPCOMING: { label: 'Upcoming', className: 'bg-slate-50 text-slate-500 border-slate-200' },
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

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">My Classes</h1>
      <p className="text-gray-500 text-sm mb-6">
        Your class history for the current school year. Scores are final once a class is completed.
      </p>

      <div className="mb-6">
        <h2 className="font-semibold text-gray-900 mb-1">Score Distribution — All Classes</h2>
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
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <ScoreDistributionChart buckets={atlDistribution.responsiblePrepared} title="Responsible & Prepared for Class" />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <ScoreDistributionChart buckets={atlDistribution.respectfulWorks} title="Respectful and Works Well with Others" />
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
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
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-4 hover:border-blue-300 hover:shadow-sm transition-all">
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
                    {new Date(row.startDate).toLocaleDateString()} – {new Date(row.endDate).toLocaleDateString()}
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
