import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { StudentSwitcher } from '@/components/parent/StudentSwitcher'

export const metadata: Metadata = { title: 'Teachers — MICDS PE Parent' }

export default async function ParentTeachersPage({
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
    select: { studentGroup: { select: { id: true } } },
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
                  teacherProfile: {
                    select: {
                      firstName: true,
                      lastName: true,
                      userId: true,
                      user: { select: { email: true } },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : []

  const seen = new Set<string>()
  const teachers = assignments
    .map((a) => {
      const tca = a.carouselPosition?.teacherClassAssignment
      const tp = tca?.teacherProfile
      if (!tp) return null
      return {
        userId: tp.userId,
        firstName: tp.firstName,
        lastName: tp.lastName,
        email: tp.user?.email ?? null,
        activity: tca?.activityTemplate?.name ?? '',
        rotationStatus: a.status,
      }
    })
    .filter((t): t is NonNullable<typeof t> => t != null)
    .filter((t) => { if (seen.has(t.userId)) return false; seen.add(t.userId); return true })

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Teachers</h1>
        <p className="text-slate-500 text-sm mt-0.5">PE teachers for your child's rotations</p>
      </div>

      <StudentSwitcher students={students} activeStudentId={activeStudent.id} baseHref="/parent/teachers" />

      {teachers.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-10 text-center">
          <p className="text-slate-400">No teachers assigned yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teachers.map((t) => (
            <div key={t.userId} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#2d1b69] flex items-center justify-center text-white font-bold text-lg shrink-0">
                {t.firstName[0]}{t.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800">{t.firstName} {t.lastName}</p>
                <p className="text-sm text-slate-500">{t.activity}</p>
                {t.email && (
                  <a href={`mailto:${t.email}`} className="text-xs text-violet-600 hover:underline mt-0.5 block">
                    {t.email}
                  </a>
                )}
              </div>
              {t.rotationStatus === 'ACTIVE' && (
                <span className="text-[10px] uppercase tracking-wider bg-violet-50 text-violet-700 font-semibold px-2 py-0.5 rounded-full shrink-0">
                  Current
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
