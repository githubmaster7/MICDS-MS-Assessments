import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'

type UpcomingAssignment = { id: string; startDate: Date; studentGroup: { name: string }; carouselPosition: { teacherClassAssignment: { activityTemplate: { name: string } } } }
type PastInstance = { id: string; startDate?: Date; endDate?: Date; studentGroup: { name: string }; teacherClassAssignment: { activityTemplate: { name: string } } }

export const metadata: Metadata = { title: 'Teacher Dashboard' }

export default async function TeacherDashboard() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const teacher = await db.teacherProfile.findUnique({ where: { userId: session.user.id } })
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

  // Find active assignment for this teacher via TeacherClassAssignment -> CarouselPosition -> GroupRotationAssignment
  const activeInstance = await db.historicalClassInstance.findFirst({
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
      teacherAssessments: { select: { id: true, studentProfileId: true } },
    },
  })

  const upcomingAssignments = await db.groupRotationAssignment.findMany({
    where: {
      status: 'UPCOMING',
      carouselPosition: {
        teacherClassAssignment: { teacherProfileId: teacher.id },
      },
    },
    include: {
      studentGroup: true,
      carouselPosition: {
        include: { teacherClassAssignment: { include: { activityTemplate: true } } },
      },
    },
    orderBy: { startDate: 'asc' },
    take: 3,
  })

  const pastInstances = await db.historicalClassInstance.findMany({
    where: {
      status: { in: ['COMPLETED', 'LOCKED'] },
      teacherClassAssignment: { teacherProfileId: teacher.id },
    },
    include: {
      studentGroup: true,
      teacherClassAssignment: { include: { activityTemplate: true } },
      groupRotationAssignment: true,
    },
    orderBy: { groupRotationAssignment: { endDate: 'desc' } },
    take: 3,
  })

  const studentCount = activeInstance?.studentGroup.memberships.length ?? 0
  const gradedCount = activeInstance?.teacherAssessments.length ?? 0
  const activityName = activeInstance?.teacherClassAssignment.activityTemplate.name

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        Welcome, {teacher.firstName}!
      </h1>
      <p className="text-gray-500 mb-6 text-sm">School Year 2024–2025</p>

      {activeInstance ? (
        <>
          <div className="bg-blue-700 text-white rounded-xl p-6 mb-6">
            <div className="text-sm text-blue-200 mb-1">Currently Teaching</div>
            <h2 className="text-xl font-bold mb-1">{activityName}</h2>
            <p className="text-blue-200">{activeInstance.studentGroup.name}</p>
            <div className="mt-4 flex items-center gap-4 text-sm">
              <div className="bg-blue-600 rounded-lg px-3 py-1.5">
                <span className="font-semibold">{studentCount}</span>
                <span className="text-blue-200 ml-1">students</span>
              </div>
              <div className="bg-blue-600 rounded-lg px-3 py-1.5">
                <span className="font-semibold">{gradedCount}</span>
                <span className="text-blue-200 ml-1">graded</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <Link href="/teacher/grade/students" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="text-2xl mb-2">✏️</div>
              <div className="font-semibold text-gray-900">Grade Students</div>
              <div className="text-sm text-gray-500 mt-0.5">{studentCount - gradedCount} students remaining</div>
            </Link>
            <Link href="/teacher/mass-grading" className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="text-2xl mb-2">📊</div>
              <div className="font-semibold text-gray-900">Year at a Glance</div>
              <div className="text-sm text-gray-500 mt-0.5">All students × all rotations</div>
            </Link>
          </div>
        </>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center mb-6">
          <p className="text-gray-500 text-sm">No active class assignment at the moment.</p>
        </div>
      )}

      {upcomingAssignments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h3 className="font-semibold text-gray-900 mb-3">Upcoming Classes</h3>
          <div className="space-y-2">
            {(upcomingAssignments as UpcomingAssignment[]).map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm p-2 bg-blue-50 rounded-lg">
                <span className="font-medium">{a.carouselPosition.teacherClassAssignment.activityTemplate.name}</span>
                <span className="text-gray-500">{a.studentGroup.name}</span>
                <span className="text-xs text-gray-400">{new Date(a.startDate).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pastInstances.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Past Classes</h3>
          <div className="space-y-2">
            {(pastInstances as PastInstance[]).map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg">
                <span className="font-medium">{a.teacherClassAssignment.activityTemplate.name}</span>
                <span className="text-gray-500">{a.studentGroup.name}</span>
                <span className="inline-flex px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs">🔒 Locked</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
