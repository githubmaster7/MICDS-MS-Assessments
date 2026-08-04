import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FeedbackItem {
  standardNumber: number
  feedback: string | null
  score?: number | null
  assessedAt?: Date | string | null
}

interface FeedbackCardProps {
  items: FeedbackItem[]
  className?: string
}

const STD_NAMES: Record<number, string> = {
  1: 'Movement Skills',
  2: 'Movement Concepts & Sport Strategies',
  3: 'Health, Fitness & Nutrition',
  4: 'Teamwork & Leadership',
}

const STD_COLORS: Record<number, string> = {
  1: 'bg-teal-50 border-teal-200 text-teal-700',
  2: 'bg-violet-50 border-violet-200 text-violet-700',
  3: 'bg-rose-50 border-rose-200 text-rose-700',
  4: 'bg-amber-50 border-amber-200 text-amber-700',
}

export function FeedbackCard({ items, className }: FeedbackCardProps) {
  const visible = items.filter((i) => i.feedback)

  if (visible.length === 0) {
    return (
      <div className={cn('bg-white rounded-xl p-5 shadow-sm border border-gray-100', className)}>
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" aria-hidden="true" /> Teacher Feedback
        </h2>
        <p className="text-sm text-gray-400 text-center py-4">
          No feedback shared yet. Check back after your teacher reviews your work.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('bg-white rounded-xl p-5 shadow-sm border border-gray-100', className)}>
      <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <MessageSquare className="h-4 w-4" aria-hidden="true" /> Teacher Feedback
      </h2>
      <div className="space-y-3">
        {visible.map((item, i) => (
          <div
            key={i}
            className={cn(
              'rounded-xl border p-3',
              STD_COLORS[item.standardNumber] ?? 'bg-gray-50 border-gray-200 text-gray-700',
            )}
          >
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-1 opacity-70">
              Standard {item.standardNumber} - {STD_NAMES[item.standardNumber] ?? ''}
            </p>
            <p className="text-sm leading-relaxed">{item.feedback}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
