import { cn } from '@/lib/utils'
import { ColorDonut, ColorDonutLegend } from './ColorDonut'
import type { ColorDistribution } from './ColorDonut'

interface StandardCardProps {
  standardNumber: 1 | 2 | 3 | 4
  name: string
  score: number | null | undefined
  distribution?: ColorDistribution
  isComplete?: boolean
  className?: string
}

const SCORE_LABEL: Record<string, string> = {
  '4':   'Advanced',
  '3.5': 'Proficient+',
  '3':   'Proficient',
  '2.5': 'Developing+',
  '2':   'Developing',
  '1.5': 'Beginning+',
  '1':   'Beginning',
}

function scoreColor(score: number): string {
  if (score >= 3.5) return 'text-emerald-600'
  if (score >= 3)   return 'text-green-600'
  if (score >= 2.5) return 'text-amber-500'
  if (score >= 2)   return 'text-orange-500'
  return 'text-red-500'
}

const EMPTY_DIST: ColorDistribution = { red: 0, yellow: 0, lightgreen: 0, brightgreen: 0 }

const STD_ICONS = ['🏃', '🧠', '❤️', '🤝'] as const

export function StandardCard({
  standardNumber,
  name,
  score,
  distribution = EMPTY_DIST,
  isComplete,
  className,
}: StandardCardProps) {
  const label = score != null ? (SCORE_LABEL[String(score)] ?? '') : ''
  const icon = STD_ICONS[standardNumber - 1]

  return (
    <div
      className={cn(
        'bg-white rounded-2xl p-4 flex flex-col gap-3 shadow-sm border border-slate-100',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-0.5">
            Standard {standardNumber}
          </p>
          <p className="text-sm font-semibold text-slate-800 leading-snug text-balance">
            {icon} {name}
          </p>
        </div>
        {isComplete != null && (
          <span
            className={cn(
              'shrink-0 text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full',
              isComplete
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700',
            )}
          >
            {isComplete ? 'Complete' : 'In Progress'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <ColorDonut distribution={distribution} size={56} strokeWidth={9} />
        <div>
          {score != null ? (
            <>
              <span className={cn('text-3xl font-black tabular-nums leading-none', scoreColor(score))}>
                {score}
              </span>
              <span className="text-xs text-slate-400 ml-1">/ 4</span>
              <p className={cn('text-xs font-medium mt-0.5', scoreColor(score))}>{label}</p>
            </>
          ) : (
            <>
              <span className="text-3xl font-black text-slate-200">—</span>
              <p className="text-xs text-slate-400 mt-0.5">Not graded yet</p>
            </>
          )}
        </div>
      </div>

      <ColorDonutLegend distribution={distribution} />
    </div>
  )
}
