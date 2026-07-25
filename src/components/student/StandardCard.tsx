import { Footprints, Brain, Heart, Handshake } from 'lucide-react'
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
  '4':   'Exceeding',
  '3.5': 'Achieving+',
  '3':   'Achieving',
  '2.5': 'Developing+',
  '2':   'Developing',
  '1.5': 'Incomplete+',
  '1':   'Incomplete',
}

function scoreColor(score: number): string {
  if (score >= 4)   return 'text-score-exceeding-text'
  if (score >= 3.5) return 'text-score-achieving-text'
  if (score >= 3)   return 'text-score-achieving-text'
  if (score >= 2.5) return 'text-score-developing-text'
  if (score >= 2)   return 'text-score-developing-text'
  return 'text-score-incomplete-text'
}

const EMPTY_DIST: ColorDistribution = { red: 0, yellow: 0, lightgreen: 0, brightgreen: 0 }

const STD_ICONS = [Footprints, Brain, Heart, Handshake] as const

export function StandardCard({
  standardNumber,
  name,
  score,
  distribution = EMPTY_DIST,
  isComplete,
  className,
}: StandardCardProps) {
  const label = score != null ? (SCORE_LABEL[String(score)] ?? '') : ''
  const Icon = STD_ICONS[standardNumber - 1]

  return (
    <div
      className={cn(
        'bg-white rounded-xl p-4 flex flex-col gap-3 shadow-sm border border-gray-100',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">
            Standard {standardNumber}
          </p>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 leading-snug text-balance">
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {name}
          </p>
        </div>
        {isComplete != null && (
          <span
            className={cn(
              'shrink-0 text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full',
              isComplete
                ? 'bg-success-50 text-success-700'
                : 'bg-warning-50 text-warning-800',
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
              <span className="text-xs text-gray-400 ml-1">/ 4</span>
              <p className={cn('text-xs font-medium mt-0.5', scoreColor(score))}>{label}</p>
            </>
          ) : (
            <>
              <span className="text-3xl font-black text-gray-200">—</span>
              <p className="text-xs text-gray-400 mt-0.5">Not graded yet</p>
            </>
          )}
        </div>
      </div>

      <ColorDonutLegend distribution={distribution} />
    </div>
  )
}
