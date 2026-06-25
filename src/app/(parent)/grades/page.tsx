import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { StudentSwitcher } from '@/components/parent/StudentSwitcher'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Grades — MICDS PE Parent' }

const SCORE_LABEL: Record<string, string> = {
  '4': 'Advanced', '3.5': 'Proficient+', '3': 'Proficient',
  '2.5': 'Developing+', '2': 'Developing', '1.5': 'Beginning+', '1': 'Beginning',
}
function scoreColor(s: number | null) {
  if (!s) return 'text-slate-300'
  if (s >= 3.5) return 'text-emerald-600'
  if (s >= 3) return 'text-green-600'
  if (s >= 2.5) return 'text-amber-500'
  if (s >= 2) return 'text-orange-500'
  return 'text-red-500'
}
const GRADE_BG: Record<string, string> = {
  A: 'bg-emerald-500', 'A-': 'bg-emerald-400',
  'B+': 'bg-blue-500', B: 'bg-blue-500', 'B-': 'bg-blue-400',
  'C+': 'bg-amber-400', C: 'bg-amber-400', 'C-': 'bg-orange-400',
  'D+': 'bg-orange-500', D: 'bg-red-400', 'D-': 'bg-red-500', F: 'bg-red-600',
}
const STD_NAMES: Record<number, string> = {
  1: 'Movement Skills', 2: 'Movement Concepts', 3: 'Health & Fitness', 4: 'Teamwork',
}

export default async function ParentGradesPage({
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
          <p className="text-sm text-amber-700 mt-1">Contact the school administrator.</p>
        </div>
      </div>
    )
  }

  const { studentId } = await searchParams
  const activeStudent = students.find((s) => s.id === studentId) ?? students[0]!

  const snapshots = await db.gradeCalculationSnapshot.findMany({
    where: { studentProfileId: activeStudent.id },
    orderBy: { calculatedAt: 'desc' },
    include: {
      historicalClassInstance: {
        include: {
          teacherClassAssignment: {
            include: {
              activityTemplate: { select: { name: true } },
              teacherProfile: { select: { firstName: true, lastName: true } },
            },
          },
          groupRotationAssignment: { select: { startDate: true, endDate: true, status: true } },
        },
      },
    },
  })
  const seen = new Set<string>()
  const dedupedSnaps = snapshots.filter((s) => {
    if (seen.has(s.historicalClassInstanceId)) return false
    seen.add(s.historicalClassInstanceId)
    return true
  })

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Grades</h1>
        <p className="text-slate-500 text-sm mt-0.5">All rotation grades for your child</p>
      </div>

      <StudentSwitcher students={students} activeStudentId={activeStudent.id} baseHref="/parent/grades" />

      {dedupedSnaps.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-10 text-center">
          <p className="text-slate-400">No grades recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dedupedSnaps.map((snap) => {
            const tca = snap.historicalClassInstance.teacherClassAssignment
            const gra = snap.historicalClassInstance.groupRotationAssignment
            const gradeBg = snap.letterGrade ? (GRADE_BG[snap.letterGrade] ?? 'bg-slate-400') : 'bg-slate-300'
            return (
              <div key={snap.historicalClassInstanceId} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className={cn('px-5 py-4 flex items-center justify-between', gradeBg)}>
                  <div className="text-white">
                    <p className="font-bold">{tca.activityTemplate.name}</p>
                    <p className="text-white/70 text-xs mt-0.5">
                      {tca.teacherProfile.firstName} {tca.teacherProfile.lastName}
                      {gra.startDate && gra.endDate && (
                        <span className="ml-2">
                          {new Date(gra.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–
                          {new Date(gra.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-center shrink-0">
                    <p className="text-3xl font-black text-white tabular-nums">{snap.letterGrade ?? '—'}</p>
                    {snap.overallAverage != null && (
                      <p className="text-[10px] text-white/60">{(snap.overallAverage * 100).toFixed(1)}%</p>
                    )}
                  </div>
                </div>
                <div className="p-4 grid grid-cols-4 gap-2">
                  {([1, 2, 3, 4] as const).map((num) => {
                    const score = [snap.standard1Score, snap.standard2Score, snap.standard3Score, snap.standard4Score][num - 1]
                    return (
                      <div key={num} className="text-center">
                        <p className="text-[10px] text-slate-400 font-medium mb-1">Std {num}</p>
                        <p className="text-xs text-slate-400 leading-tight mb-1">{STD_NAMES[num]}</p>
                        <p className={cn('text-xl font-black tabular-nums', scoreColor(score ?? null))}>
                          {score ?? '—'}
                        </p>
                        {score != null && (
                          <p className={cn('text-[10px]', scoreColor(score))}>
                            {SCORE_LABEL[String(score)] ?? ''}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
