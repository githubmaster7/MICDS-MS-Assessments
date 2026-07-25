import { cn } from '@/lib/utils'

interface GradeCardProps {
  letterGrade: string | null | undefined
  overallAverage?: number | null
  activityName?: string
  teacherName?: string
  className?: string
}

const GRADE_CONFIGS: Record<string, { bg: string; ring: string; text: string; label: string }> = {
  A:   { bg: 'bg-emerald-500', ring: 'ring-emerald-400', text: 'text-white', label: 'Excellent work!' },
  'A-':{ bg: 'bg-emerald-400', ring: 'ring-emerald-300', text: 'text-white', label: 'Outstanding!' },
  'B+':{ bg: 'bg-blue-500',    ring: 'ring-blue-400',    text: 'text-white', label: 'Great job!' },
  B:   { bg: 'bg-blue-500',    ring: 'ring-blue-400',    text: 'text-white', label: 'Keep it up!' },
  'B-':{ bg: 'bg-blue-400',    ring: 'ring-blue-300',    text: 'text-white', label: 'Good work!' },
  'C+':{ bg: 'bg-amber-400',   ring: 'ring-amber-300',   text: 'text-white', label: 'Making progress!' },
  C:   { bg: 'bg-amber-400',   ring: 'ring-amber-300',   text: 'text-white', label: 'Keep working!' },
  'C-':{ bg: 'bg-orange-400',  ring: 'ring-orange-300',  text: 'text-white', label: 'You can improve!' },
  'D+':{ bg: 'bg-orange-500',  ring: 'ring-orange-400',  text: 'text-white', label: 'Needs improvement' },
  D:   { bg: 'bg-red-400',     ring: 'ring-red-300',     text: 'text-white', label: 'See your teacher' },
  'D-':{ bg: 'bg-red-500',     ring: 'ring-red-400',     text: 'text-white', label: 'See your teacher' },
  F:   { bg: 'bg-red-600',     ring: 'ring-red-500',     text: 'text-white', label: 'See your teacher' },
}

export function GradeCard({ letterGrade, overallAverage, activityName, teacherName, className }: GradeCardProps) {
  const cfg = letterGrade ? GRADE_CONFIGS[letterGrade] : null
  const bg = cfg?.bg ?? 'bg-gray-300'
  const ring = cfg?.ring ?? 'ring-gray-200'
  const label = cfg?.label ?? ''

  return (
    <div
      className={cn(
        'rounded-xl p-6 flex items-center gap-5 shadow-sm',
        bg,
        className,
      )}
    >
      {/* Giant grade circle */}
      <div
        className={cn(
          'shrink-0 w-20 h-20 rounded-full ring-4 flex flex-col items-center justify-center',
          ring,
          'bg-white/20',
        )}
      >
        <span className="text-4xl font-black text-white tabular-nums leading-none">
          {letterGrade ?? '—'}
        </span>
        <span className="text-[10px] text-white/70 uppercase tracking-wider mt-0.5">Grade</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white/60 text-xs uppercase tracking-wider font-medium mb-0.5">
          Current Overall Grade
        </p>
        {label && (
          <p className="text-white font-bold text-lg leading-tight mb-1">{label}</p>
        )}
        {overallAverage != null && (
          <p className="text-white/80 text-sm tabular-nums">
            {(overallAverage * 100).toFixed(1)}% average
          </p>
        )}
        {activityName && (
          <p className="text-white font-semibold mt-2 truncate">{activityName}</p>
        )}
        {teacherName && (
          <p className="text-white/70 text-sm truncate">with {teacherName}</p>
        )}
      </div>
    </div>
  )
}
