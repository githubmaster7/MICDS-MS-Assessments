import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { RotationTimeline } from '@/components/student/RotationTimeline'

export const metadata: Metadata = { title: 'My History — MICDS PE' }

export default async function StudentHistoryPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'STUDENT') redirect('/unauthorized')

  const student = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      firstName: true,
      groupMemberships: {
        where: { leftAt: null },
        take: 1,
        include: { studentGroup: { select: { id: true, name: true } } },
      },
    },
  })
  if (!student) return <div className="p-6 text-slate-500">Student profile not found.</div>

  const group = student.groupMemberships[0]?.studentGroup

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
                where: { studentProfileId: student.id },
                orderBy: { calculatedAt: 'desc' },
                take: 1,
                select: { letterGrade: true, overallAverage: true },
              },
            },
          },
        },
      })
    : []

  const timelineEntries = assignments.map((a) => {
    const tca = a.carouselPosition?.teacherClassAssignment
    const inst = a.historicalClassInstances[0]
    const snap = inst?.gradeSnapshots[0]
    return {
      instanceId: inst?.id,
      rotationNumber: a.rotationNumber,
      activityName: tca?.activityTemplate?.name ?? 'Unknown Activity',
      teacherName: tca?.teacherProfile
        ? `${tca.teacherProfile.firstName} ${tca.teacherProfile.lastName}`
        : undefined,
      letterGrade: snap?.letterGrade ?? null,
      status: a.status,
      startDate: a.startDate,
      endDate: a.endDate,
    }
  })

  const currentEntry = timelineEntries.find((e) => e.status === 'ACTIVE')

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900">My History</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {group?.name ?? 'No group assigned'} · All rotations this year
        </p>
      </div>

      {timelineEntries.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-10 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📅</p>
          <p className="font-semibold text-slate-600">No classes yet</p>
          <p className="text-slate-400 text-sm mt-1">Your rotation schedule will appear here once it's set up.</p>
        </div>
      ) : (
        <RotationTimeline
          rotations={timelineEntries}
          currentInstanceId={currentEntry?.instanceId}
        />
      )}
    </div>
  )
}
