import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { PencilLine, BarChart3, Lock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'

type UpcomingAssignment = { id: string; startDate: Date; studentGroup: { name: string }; carouselPosition: { teacherClassAssignment: { activityTemplate: { name: string } } } }
type PastInstance = { id: string; startDate?: Date; endDate?: Date; studentGroup: { name: string }; teacherClassAssignment: { activityTemplate: { name: string } } }

export const metadata: Metadata = { title: 'Teacher Dashboard' }

export default async function TeacherDashboard() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const teacher = await db.teacherProfile.findUnique({ where: { userId: session.user.id } })
  const activeSchoolYear = await db.schoolYear.findFirst({ where: { isActive: true }, select: { name: true } })
  if (!teacher) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <h2 className="font-semibold text-yellow-800 mb-1">Profile Not Set Up</h2>
          <p className="text-yellow-700 text-sm">Your teacher profile hasn't been created yet. Contact an administrator.</p>
        </div>
      </div>
    )
  }

  // Find ALL active assignments for this teacher — the multi-group carousel
  // architecture lets one teacher teach several groups at once (each
  // rotating independently), so there can be more than one currently-active
  // class instance at a time.
  const activeInstances = await db.historicalClassInstance.findMany({
    where: {
      status: 'ACTIVE',
      teacherClassAssignment: { teacherProfileId: teacher.id },
    },
    include: {
      studentGroup: {
        include: {
          memberships: { where: { leftAt: null } },
        },
      },
      teacherClassAssignment: {
        include: { activityTemplate: true },
      },
      groupRotationAssignment: true,
      teacherAssessments: { select: { id: true, studentProfileId: true, standardNumber: true } },
    },
    orderBy: { studentGroup: { name: 'asc' } },
  })

  const upcomingWhere = {
    status: 'UPCOMING' as const,
    carouselPosition: {
      teacherClassAssignment: { teacherProfileId: teacher.id },
    },
  }
  const [upcomingAssignments, upcomingTotal] = await Promise.all([
    db.groupRotationAssignment.findMany({
      where: upcomingWhere,
      include: {
        studentGroup: true,
        carouselPosition: {
          include: { teacherClassAssignment: { include: { activityTemplate: true } } },
        },
      },
      orderBy: { startDate: 'asc' },
      take: 3,
    }),
    db.groupRotationAssignment.count({ where: upcomingWhere }),
  ])

  const pastWhere = {
    status: { in: ['COMPLETED', 'LOCKED'] as ('COMPLETED' | 'LOCKED')[] },
    teacherClassAssignment: { teacherProfileId: teacher.id },
  }
  const pastTotal = await db.historicalClassInstance.count({ where: pastWhere })

  const pastInstances = await db.historicalClassInstance.findMany({
    where: pastWhere,
    include: {
      studentGroup: true,
      teacherClassAssignment: { include: { activityTemplate: true } },
      groupRotationAssignment: true,
    },
    orderBy: { groupRotationAssignment: { endDate: 'desc' } },
    take: 3,
  })

  // "Graded" means all 4 standards recorded for a student, not raw assessment rows
  // (each student has up to 4 TeacherAssessment rows, one per standard) —
  // computed per active instance, since each is its own class/roster.
  const activeClassCards = activeInstances.map((instance) => {
    const studentCount = instance.studentGroup.memberships.length
    const standardsByStudent = new Map<string, Set<number>>()
    for (const a of instance.teacherAssessments) {
      const set = standardsByStudent.get(a.studentProfileId) ?? new Set<number>()
      set.add(a.standardNumber)
      standardsByStudent.set(a.studentProfileId, set)
    }
    const gradedCount = Array.from(standardsByStudent.values()).filter((s) => s.size === 4).length
    return {
      id: instance.id,
      activityName: instance.teacherClassAssignment.activityTemplate.name,
      groupName: instance.studentGroup.name,
      studentCount,
      gradedCount,
    }
  })

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <PageHeader
        variant="primary"
        title={<>Welcome, {teacher.firstName}!</>}
        description={activeSchoolYear ? `School Year ${activeSchoolYear.name}` : undefined}
      />

      {activeClassCards.length > 0 ? (
        <div className="space-y-4 mb-6">
          {activeClassCards.map((card) => (
            <div key={card.id}>
              <div className="bg-white border border-gray-200 border-l-4 border-l-primary-700 rounded-xl p-6">
                <div className="text-sm font-semibold text-primary-900 mb-1">Currently Teaching</div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">{card.activityName}</h2>
                <p className="text-gray-500">{card.groupName}</p>
                <div className="mt-4 flex items-center gap-4 text-sm">
                  <div className="bg-primary-50 border border-primary-100 rounded-lg px-3 py-1.5">
                    <span className="font-semibold text-gray-900">{card.studentCount}</span>
                    <span className="text-gray-500 ml-1">students</span>
                  </div>
                  <div className="bg-primary-50 border border-primary-100 rounded-lg px-3 py-1.5">
                    <span className="font-semibold text-gray-900">{card.gradedCount}</span>
                    <span className="text-gray-500 ml-1">graded</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-3">
                <Link href={`/teacher/grade/students?instanceId=${card.id}`} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-primary-300 hover:shadow-sm transition-all">
                  <PencilLine className="h-6 w-6 mb-2 text-primary-900" aria-hidden="true" />
                  <div className="font-semibold text-gray-900">Grade Students</div>
                  <div className="text-sm text-gray-500 mt-0.5">{card.studentCount - card.gradedCount} students remaining</div>
                </Link>
                <Link href={`/teacher/mass-grading?instanceId=${card.id}`} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-primary-300 hover:shadow-sm transition-all">
                  <BarChart3 className="h-6 w-6 mb-2 text-primary-900" aria-hidden="true" />
                  <div className="font-semibold text-gray-900">Year at a Glance</div>
                  <div className="text-sm text-gray-500 mt-0.5">{card.groupName} - all rotations</div>
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center mb-6">
          <p className="text-gray-500 text-sm">No active class assignment at the moment.</p>
        </div>
      )}

      {upcomingAssignments.length > 0 && (
        <div className="bg-white rounded-xl border border-primary-200 p-5 mb-4">
          <h3 className="font-semibold text-gray-900 mb-3">
            Upcoming Classes
            {upcomingTotal > upcomingAssignments.length && (
              <span className="font-normal text-gray-400 text-sm ml-2">
                (showing next {upcomingAssignments.length} of {upcomingTotal})
              </span>
            )}
          </h3>
          <div className="space-y-2">
            {(upcomingAssignments as UpcomingAssignment[]).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm p-2 bg-primary-50 rounded-lg">
                <span className="font-medium">{a.carouselPosition.teacherClassAssignment.activityTemplate.name}</span>
                <span className="text-gray-500">{a.studentGroup.name}</span>
                <span className="text-xs text-gray-400 ml-auto">{formatDate(a.startDate)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pastInstances.length > 0 && (
        <div className="bg-white rounded-xl border border-primary-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">
            Past Classes
            {pastTotal > pastInstances.length && (
              <span className="font-normal text-gray-400 text-sm ml-2">
                (showing {pastInstances.length} of {pastTotal} - see Teaching History for all)
              </span>
            )}
          </h3>
          <div className="space-y-2">
            {(pastInstances as PastInstance[]).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm p-2 bg-white border border-gray-100 rounded-lg">
                <span className="font-medium">{a.teacherClassAssignment.activityTemplate.name}</span>
                <span className="text-gray-500">{a.studentGroup.name}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs ml-auto">
                  <Lock className="h-3 w-3" aria-hidden="true" /> Locked
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
