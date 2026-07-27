'use client'

import { useState } from 'react'

export interface StudentScoreCount {
  studentProfileId: string
  studentName: string
  count: number
}

export interface GroupScoreBucket {
  score: number
  total: number
  byStudent: StudentScoreCount[]
}

// Mirrors src/components/student/ScoreDistributionChart.tsx exactly, but the
// hover breakdown is by student instead of by class — this is the teacher's
// group view: pooling every individual teacher-rated item for one standard
// across every student in a single class instance.
const SCORE_COLOR: Record<string, string> = {
  '4': '#00ff00',
  '3': '#6aa84f',
  '2': '#d97706',
  '1': '#ff0000',
}

const SCORE_LABEL: Record<string, string> = {
  '4': 'Exceeding',
  '3': 'Achieving',
  '2': 'Developing',
  '1': 'Incomplete',
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`
}

export function GroupScoreDistributionChart({ buckets, title }: { buckets: GroupScoreBucket[]; title?: string }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const total = buckets.reduce((sum, b) => sum + b.total, 0)

  if (total === 0) {
    return (
      <div className="rounded-xl bg-gray-50 border border-primary-200 p-6 text-center text-sm text-gray-400">
        {title && <div className="font-semibold text-gray-500 mb-1">{title}</div>}
        No graded items yet for this class.
      </div>
    )
  }

  const gapDeg = 360 * (1.2 / (2 * Math.PI * 80))
  let cursor = 0
  const slices = buckets.map((b) => {
    const span = (b.total / total) * 360
    const startAngle = cursor + gapDeg / 2
    const endAngle = cursor + span - gapDeg / 2
    cursor += span
    return { ...b, startAngle: Math.min(startAngle, endAngle), endAngle: Math.max(startAngle, endAngle) }
  })

  const hoveredBucket = hovered !== null ? slices[hovered] : null

  return (
    <div>
      {title && <h3 className="font-semibold text-gray-800 mb-3">{title}</h3>}
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative shrink-0">
          <svg viewBox="0 0 200 200" width={200} height={200} role="img" aria-label={title ? `Distribution of ${title} scores across the class` : 'Distribution of scores across the class'}>
            {slices.map((s, i) => (
              <path
                key={s.score}
                d={arcPath(100, 100, 80, s.startAngle, s.endAngle)}
                fill={SCORE_COLOR[String(s.score)] ?? '#cbd5e1'}
                stroke="white"
                strokeWidth={hovered === i ? 3 : 1}
                opacity={hovered === null || hovered === i ? 1 : 0.55}
                className="transition-opacity cursor-pointer"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <title suppressHydrationWarning>{`${SCORE_LABEL[String(s.score)]} (${s.score}): ${s.total} total - ${s.byStudent.map((c) => `${c.studentName}: ${c.count}`).join(', ')}`}</title>
              </path>
            ))}
          </svg>
          {hoveredBucket && (
            <div className="absolute inset-x-0 -bottom-2 trangray-y-full bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg z-10 min-w-[180px]">
              <div className="font-semibold mb-1">
                {SCORE_LABEL[String(hoveredBucket.score)]} ({hoveredBucket.score}) - {hoveredBucket.total} total
              </div>
              {hoveredBucket.byStudent.map((c) => (
                <div key={c.studentProfileId} className="flex justify-between gap-3 text-gray-200">
                  <span>{c.studentName}</span>
                  <span className="tabular-nums font-medium">{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 w-full space-y-1.5">
          {slices.map((s, i) => (
            <button
              key={s.score}
              type="button"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className={`w-full flex items-center gap-2 text-sm px-2 py-1 rounded-lg transition-colors ${hovered === i ? 'bg-gray-100' : ''}`}
            >
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: SCORE_COLOR[String(s.score)] }}
                aria-hidden="true"
              />
              <span className="text-gray-700 flex-1 text-left">
                {SCORE_LABEL[String(s.score)]} ({s.score})
              </span>
              <span className="text-gray-400 tabular-nums">
                {s.total} · {Math.round((s.total / total) * 100)}%
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const STANDARD_NAMES: Record<1 | 2 | 3 | 4, string> = {
  1: 'Standard 1: Movement Skills',
  2: 'Standard 2: Movement Concepts & Sport Strategies',
  3: 'Standard 3: Health, Fitness & Nutrition',
  4: 'Standard 4: Teamwork & Leadership',
}

export function GroupStandardDistributionGrid({
  distributions,
}: {
  distributions: Record<1 | 2 | 3 | 4, GroupScoreBucket[]>
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {([1, 2, 3, 4] as const).map((std) => (
        <div key={std} className="bg-white rounded-xl border border-primary-200 p-4">
          <GroupScoreDistributionChart buckets={distributions[std]} title={STANDARD_NAMES[std]} />
        </div>
      ))}
    </div>
  )
}
