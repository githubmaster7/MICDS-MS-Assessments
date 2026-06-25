import { cn } from '@/lib/utils'

interface RotationEntry {
  instanceId?: string
  rotationNumber?: number
  activityName: string
  teacherName?: string
  letterGrade?: string | null
  status: 'UPCOMING' | 'ACTIVE' | 'GRADING' | 'COMPLETED' | 'ARCHIVED' | string
  startDate?: string | Date | null
  endDate?: string | Date | null
}

interface RotationTimelineProps {
  rotations: RotationEntry[]
  currentInstanceId?: string
  className?: string
}

const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald-700 bg-emerald-50',
  'A-': 'text-emerald-600 bg-emerald-50',
  'B+': 'text-blue-700 bg-blue-50',
  B: 'text-blue-700 bg-blue-50',
  'B-': 'text-blue-600 bg-blue-50',
  'C+': 'text-amber-700 bg-amber-50',
  C: 'text-amber-700 bg-amber-50',
  'C-': 'text-orange-700 bg-orange-50',
  'D+': 'text-orange-700 bg-orange-50',
  D: 'text-red-700 bg-red-50',
  'D-': 'text-red-700 bg-red-50',
  F: 'text-red-800 bg-red-100',
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ACTIVE') {
    return (
      <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
        Current
      </span>
    )
  }
  if (status === 'UPCOMING') {
    return (
      <span className="text-[10px] uppercase tracking-wider font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
        Upcoming
      </span>
    )
  }
  if (status === 'GRADING') {
    return (
      <span className="text-[10px] uppercase tracking-wider font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
        Being Graded
      </span>
    )
  }
  return null
}

export function RotationTimeline({ rotations, currentInstanceId, className }: RotationTimelineProps) {
  if (rotations.length === 0) {
    return (
      <div className={cn('bg-white rounded-2xl p-5 shadow-sm border border-slate-100', className)}>
        <h2 className="font-semibold text-slate-800 mb-3">My Classes This Year</h2>
        <p className="text-sm text-slate-400 text-center py-4">No classes assigned yet.</p>
      </div>
    )
  }

  return (
    <div className={cn('bg-white rounded-2xl p-5 shadow-sm border border-slate-100', className)}>
      <h2 className="font-semibold text-slate-800 mb-4">My Classes This Year</h2>
      <ol className="relative space-y-0">
        {rotations.map((r, i) => {
          const isCurrent =
            r.instanceId === currentInstanceId || r.status === 'ACTIVE'
          const isUpcoming = r.status === 'UPCOMING'
          const isLast = i === rotations.length - 1

          return (
            <li key={r.instanceId ?? i} className="relative flex gap-4">
              {/* Connector line */}
              {!isLast && (
                <span
                  className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-100"
                  aria-hidden="true"
                />
              )}

              {/* Dot */}
              <div
                className={cn(
                  'shrink-0 w-6 h-6 rounded-full border-2 mt-0.5 flex items-center justify-center',
                  isCurrent
                    ? 'border-blue-500 bg-blue-500'
                    : isUpcoming
                    ? 'border-slate-300 bg-white'
                    : 'border-emerald-300 bg-emerald-50',
                )}
                aria-hidden="true"
              >
                {isCurrent && (
                  <span className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>

              {/* Content */}
              <div
                className={cn(
                  'flex-1 pb-4 min-w-0',
                  isCurrent && 'pb-5',
                )}
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <span
                      className={cn(
                        'font-semibold text-sm',
                        isUpcoming ? 'text-slate-400' : 'text-slate-800',
                      )}
                    >
                      {r.activityName}
                    </span>
                    {r.teacherName && (
                      <span className="text-slate-400 text-sm ml-2">
                        with {r.teacherName}
                      </span>
                    )}
                    {r.startDate && r.endDate && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(r.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' – '}
                        {new Date(r.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={r.status} />
                    {r.letterGrade ? (
                      <span
                        className={cn(
                          'font-bold text-sm tabular-nums px-2 py-0.5 rounded-lg',
                          GRADE_COLORS[r.letterGrade] ?? 'text-slate-700 bg-slate-100',
                        )}
                      >
                        {r.letterGrade}
                      </span>
                    ) : isUpcoming ? (
                      <span className="text-xs text-slate-300">N/A</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
