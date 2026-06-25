'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface Student {
  id: string
  firstName: string
  lastName: string
  gradeLevel?: string
}

interface StudentSwitcherProps {
  students: Student[]
  activeStudentId: string
  baseHref: string
  className?: string
}

export function StudentSwitcher({
  students,
  activeStudentId,
  baseHref,
  className,
}: StudentSwitcherProps) {
  const router = useRouter()

  if (students.length <= 1) {
    const s = students[0]
    if (!s) return null
    return (
      <div className={cn('rounded-xl bg-violet-50 border border-violet-200 px-4 py-2.5', className)}>
        <p className="text-xs text-violet-500 font-medium">Viewing</p>
        <p className="font-semibold text-violet-900">
          {s.firstName} {s.lastName}
          {s.gradeLevel && (
            <span className="text-violet-500 font-normal ml-2 text-sm">
              Grade {s.gradeLevel.replace('GRADE_', '')}
            </span>
          )}
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs uppercase tracking-wider text-slate-400 font-medium px-1">
        Viewing student
      </p>
      <div className="flex flex-wrap gap-2">
        {students.map((s) => {
          const active = s.id === activeStudentId
          return (
            <button
              key={s.id}
              onClick={() => router.push(`${baseHref}/${s.id}`)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-semibold transition-colors border-2',
                active
                  ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-violet-300 hover:text-violet-700',
              )}
            >
              {s.firstName} {s.lastName}
              {s.gradeLevel && (
                <span className={cn('ml-1.5 text-xs font-normal', active ? 'text-violet-200' : 'text-slate-400')}>
                  Gr. {s.gradeLevel.replace('GRADE_', '')}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
