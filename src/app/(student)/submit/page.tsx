import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Submit Work — MICDS PE' }

export default async function SubmitIndexPage() {
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
        include: {
          studentGroup: {
            select: {
              groupRotationAssignments: {
                where: { status: 'ACTIVE' },
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
                    where: { status: { not: 'LOCKED' } },
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, status: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!student) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-8 text-center">
          <p className="font-semibold text-amber-800">Profile Not Set Up</p>
          <p className="text-sm text-amber-700 mt-1">Contact your teacher or administrator.</p>
        </div>
      </div>
    )
  }

  const membership = student.groupMemberships[0]
  const activeRotation = membership?.studentGroup?.groupRotationAssignments[0] ?? null
  const currentInstance = activeRotation?.historicalClassInstances[0] ?? null
  const tca = activeRotation?.carouselPosition?.teacherClassAssignment
  const activityName = tca?.activityTemplate?.name
  const teacherName = tca?.teacherProfile
    ? `${tca.teacherProfile.firstName} ${tca.teacherProfile.lastName}`
    : undefined

  // Existing submissions for current instance
  const existingSubmissions = currentInstance
    ? await db.studentSubmission.findMany({
        where: {
          studentProfileId: student.id,
          historicalClassInstanceId: currentInstance.id,
        },
        select: {
          standardNumber: true,
          status: true,
          honorCodeAcknowledgedAt: true,
          updatedAt: true,
        },
      })
    : []

  const isSubmitted = existingSubmissions.some((s) => s.honorCodeAcknowledgedAt != null)

  // Reassessment not modeled yet — set to false by default
  const reassessmentAllowed = false

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Submit Work</h1>
        <p className="text-slate-500 text-sm mt-0.5">Written responses for your current class</p>
      </div>

      {!currentInstance || !activityName ? (
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-10 text-center">
          <p className="text-4xl mb-3" aria-hidden="true">📭</p>
          <p className="font-semibold text-slate-600">No active assignment</p>
          <p className="text-slate-400 text-sm mt-1">
            You don't have an active class right now. Check back when a new rotation starts!
          </p>
        </div>
      ) : (
        <>
          {/* Current assignment card */}
          <div className="rounded-2xl bg-blue-600 text-white p-5">
            <p className="text-xs uppercase tracking-wider text-blue-200 font-medium mb-1">
              Current Class
            </p>
            <p className="text-lg font-bold">{activityName}</p>
            {teacherName && <p className="text-blue-200 text-sm mt-0.5">with {teacherName}</p>}

            <div className="mt-4 grid grid-cols-3 gap-3">
              {([2, 3, 4] as const).map((stdNum) => {
                const sub = existingSubmissions.find((s) => s.standardNumber === stdNum)
                const submitted = !!sub?.honorCodeAcknowledgedAt
                const draft = sub && !submitted
                return (
                  <div key={stdNum} className="bg-white/10 rounded-xl p-3 text-center">
                    <p className="text-xs text-blue-200 font-medium">Standard {stdNum}</p>
                    <p className={cn(
                      'text-xs mt-1 font-semibold',
                      submitted ? 'text-emerald-300' : draft ? 'text-amber-300' : 'text-white/50',
                    )}>
                      {submitted ? '✓ Submitted' : draft ? 'Draft saved' : 'Not started'}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Status / CTA */}
          {isSubmitted && !reassessmentAllowed ? (
            <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 p-6 text-center">
              <p className="text-3xl mb-2" aria-hidden="true">✅</p>
              <p className="font-bold text-emerald-800">Work Submitted</p>
              <p className="text-sm text-emerald-700 mt-1">
                You've already submitted your work for {activityName}. Your teacher will review it and share feedback soon.
              </p>
            </div>
          ) : (
            <Link
              href={`/student/submit/${currentInstance.id}`}
              className="flex items-center justify-between rounded-2xl bg-slate-900 text-white px-5 py-4 hover:bg-slate-800 transition-colors shadow-sm"
            >
              <div>
                <p className="font-bold">
                  {isSubmitted && reassessmentAllowed ? 'Update & Resubmit' : 'Start Submission'}
                </p>
                <p className="text-slate-400 text-sm mt-0.5">
                  Standards 2, 3, and 4 · Honor Code required
                </p>
              </div>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M7 10h6M10 7l3 3-3 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}

          {reassessmentAllowed && (
            <p className="text-xs text-center text-blue-600">
              Reassessment approved — you may resubmit your work.
            </p>
          )}
        </>
      )}
    </div>
  )
}
