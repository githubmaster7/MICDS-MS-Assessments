import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { RotationTimeline } from '@/components/student/RotationTimeline'
import { StudentSwitcher } from '@/components/parent/StudentSwitcher'

export const metadata: Metadata = { title: 'History — MICDS PE Parent' }

export default async function ParentHistoryPage({
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

  const links = await db.parentStudentLink.findMany({
    where: { parentProfileId: parentProfile.id },
    include: {
      studentProfile: { select: { id: true, firstName: true, lastName: true, gradeLevel: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  const students = links.map((l) => l.studentProfile)
  if (students.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-8 text-center">
          <p className="font-semibold text-amber-800">No Students Linked</p>
        </div>
      </div>
    )
  }

  const { studentId } = await searchParams
  const activeStudent = students.find((s) => s.id === studentId) ?? students[0]!

  const membership = await db.studentGroupMembership.findFirst({
    where: { studentProfileId: activeStudent.id, leftAt: null },
    select: { studentGroup: { select: { id: true, name: true } } },
  })
  const group = membership?.studentGroup

  const assignments = group
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

  const timelineEntries = assignments.map((a) => {
    const tca = a.carouselPosition?.teacherClassAssignment
    const inst = a.historicalClassInstances[0]
    return {
      instanceId: inst?.id,
      rotationNumber: a.rotationNumber,
      activityName: tca?.activityTemplate?.name ?? 'Unknown Activity',
      teacherName: tca?.teacherProfile
        ? `${tca.teacherProfile.firstName} ${tca.teacherProfile.lastName}`
        : undefined,
      letterGrade: inst?.gradeSnapshots[0]?.letterGrade ?? null,
      status: a.status,
      startDate: a.startDate,
      endDate: a.endDate,
    }
  })
  const currentEntry = timelineEntries.find((e) => e.status === 'ACTIVE')

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900">History</h1>
        <p className="text-slate-500 text-sm mt-0.5">All PE rotations this year</p>
      </div>

      <StudentSwitcher students={students} activeStudentId={activeStudent.id} baseHref="/parent/history" />

      <RotationTimeline
        rotations={timelineEntries}
        currentInstanceId={currentEntry?.instanceId}
      />
    </div>
  )
}
