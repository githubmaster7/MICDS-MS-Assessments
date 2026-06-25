import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'My Teachers — MICDS PE' }

export default async function TeachersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'STUDENT') redirect('/unauthorized')

  const student = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      groupMemberships: {
        where: { leftAt: null },
        take: 1,
        select: { studentGroup: { select: { id: true } } },
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

  // De-dupe by teacherProfile userId
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
    .filter((t) => {
      if (seen.has(t.userId)) return false
      seen.add(t.userId)
      return true
    })

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900">My Teachers</h1>
        <p className="text-slate-500 text-sm mt-0.5">PE teachers assigned to your rotations</p>
      </div>

      {teachers.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-10 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">👤</p>
          <p className="font-semibold text-slate-600">No teachers assigned yet</p>
          <p className="text-slate-400 text-sm mt-1">Teachers will appear here once your rotation schedule is set.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {teachers.map((t) => (
            <div
              key={t.userId}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white font-bold text-lg shrink-0">
                {t.firstName[0]}{t.lastName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800">
                  {t.firstName} {t.lastName}
                </p>
                <p className="text-sm text-slate-500">{t.activity}</p>
                {t.email && (
                  <a
                    href={`mailto:${t.email}`}
                    className="text-xs text-blue-600 hover:underline mt-0.5 block"
                  >
                    {t.email}
                  </a>
                )}
              </div>
              {t.rotationStatus === 'ACTIVE' && (
                <span className="text-[10px] uppercase tracking-wider bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full shrink-0">
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
