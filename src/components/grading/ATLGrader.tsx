'use client'

import { useMemo } from 'react'
import { calculateApproachToLearning, calculateDaysLateScore } from '@/lib/grading/approach-to-learning'

type Rating = 1 | 2 | 3 | 4

const RATING_LABELS: Record<Rating, string> = {
  1: 'Beginning',
  2: 'Developing',
  3: 'Proficient',
  4: 'Advanced',
}

const RATING_COLORS: Record<Rating, string> = {
  1: 'bg-red-100 text-red-700 border-red-200',
  2: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  3: 'bg-green-100 text-green-700 border-green-200',
  4: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const SCORE_BADGE: Record<string, string> = {
  '4': 'bg-emerald-500 text-white',
  '3.5': 'bg-green-400 text-white',
  '3': 'bg-green-300 text-green-900',
  '2.5': 'bg-yellow-300 text-yellow-900',
  '2': 'bg-yellow-200 text-yellow-800',
  '1.5': 'bg-orange-300 text-orange-900',
  '1': 'bg-red-400 text-white',
}

function RatingSelector({
  label,
  value,
  onChange,
  readOnly = false,
}: {
  label: string
  value: Rating
  onChange?: (v: Rating) => void
  readOnly?: boolean
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-52 text-sm text-slate-700 leading-tight">{label}</div>
      {readOnly ? (
        <div className={`px-3 py-1 rounded-lg border text-sm font-medium ${RATING_COLORS[value]}`}>
          {value} – {RATING_LABELS[value]}
        </div>
      ) : (
        <div className="flex gap-1.5" role="radiogroup" aria-label={label}>
          {([1, 2, 3, 4] as Rating[]).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={value === v}
              onClick={() => onChange?.(v)}
              className={`w-8 h-8 rounded border-2 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                value === v
                  ? RATING_COLORS[v] + ' scale-105 shadow-sm border-current'
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      )}
      {!readOnly && (
        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${RATING_COLORS[value]}`}>
          {RATING_LABELS[value]}
        </span>
      )}
    </div>
  )
}

interface ATLGraderProps {
  daysLate: number
  onDaysLateChange: (v: number) => void
  effortStudentScore: Rating
  effortTeacherScore: Rating
  onEffortTeacherChange: (v: Rating) => void
  responsiblePrepared: Rating
  onResponsiblePreparedChange: (v: Rating) => void
  respectfulWorks: Rating
  onRespectfulWorksChange: (v: Rating) => void
}

export function ATLGrader({
  daysLate,
  onDaysLateChange,
  effortStudentScore,
  effortTeacherScore,
  onEffortTeacherChange,
  responsiblePrepared,
  onResponsiblePreparedChange,
  respectfulWorks,
  onRespectfulWorksChange,
}: ATLGraderProps) {
  const daysLateScore = calculateDaysLateScore(daysLate)

  const result = useMemo(() => {
    try {
      return calculateApproachToLearning({
        daysLateUnprepared: daysLate,
        effortStudentScore,
        effortTeacherScore,
        responsiblePrepared,
        respectfulWorks,
      })
    } catch { return null }
  }, [daysLate, effortStudentScore, effortTeacherScore, responsiblePrepared, respectfulWorks])

  const daysLateColor =
    daysLate === 0 ? 'text-emerald-600' :
    daysLate <= 3 ? 'text-yellow-700' :
    daysLate <= 6 ? 'text-orange-700' : 'text-red-700'

  const scoreBucket = result
    ? String(result.calculatedScore >= 3.75 ? 4 :
        result.calculatedScore >= 3.25 ? 3.5 :
        result.calculatedScore >= 2.75 ? 3 :
        result.calculatedScore >= 2.25 ? 2.5 :
        result.calculatedScore >= 1.75 ? 2 :
        result.calculatedScore >= 1.25 ? 1.5 : 1)
    : '2'

  return (
    <div className="space-y-5">
      {/* Score summary */}
      {result && (
        <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex-1">
            <div className="text-xs text-slate-500 mb-1.5">ATL Component Scores</div>
            <div className="flex gap-4 text-xs text-slate-600 flex-wrap">
              <span>Days late → <strong>{daysLateScore}</strong></span>
              <span>Effort (student) → <strong>{effortStudentScore}</strong></span>
              <span>Effort (teacher) → <strong>{effortTeacherScore}</strong></span>
              <span>Resp. & Prepared → <strong>{responsiblePrepared}</strong></span>
              <span>Respectful → <strong>{respectfulWorks}</strong></span>
            </div>
          </div>
          <div className="text-center shrink-0">
            <div className="text-xs text-slate-500 mb-1">ATL Score</div>
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-base font-bold ${SCORE_BADGE[scoreBucket] ?? 'bg-slate-200 text-slate-700'}`}>
              {result.calculatedScore.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Days late counter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Days Late / Unprepared
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onDaysLateChange(Math.max(0, daysLate - 1))}
              disabled={daysLate === 0}
              className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              −
            </button>
            <span className={`text-2xl font-bold tabular-nums w-8 text-center ${daysLateColor}`}>
              {daysLate}
            </span>
            <button
              type="button"
              onClick={() => onDaysLateChange(daysLate + 1)}
              className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              +
            </button>
          </div>
          <div className="text-sm text-slate-600">
            →{' '}
            <span className={`font-semibold ${RATING_COLORS[daysLateScore].split(' ')[1]}`}>
              Score {daysLateScore}
            </span>
            <span className="text-xs text-slate-400 ml-1">
              ({daysLate === 0 ? '0 days' : daysLate <= 3 ? '1–3 days' : daysLate <= 6 ? '4–6 days' : '7+ days'})
            </span>
          </div>
        </div>
        <div className="mt-2 flex gap-1">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onDaysLateChange(d)}
              className={`w-7 h-6 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-400 ${
                daysLate === d
                  ? d === 0 ? 'bg-emerald-500 text-white' : d <= 3 ? 'bg-yellow-400 text-yellow-900' : d <= 6 ? 'bg-orange-400 text-white' : 'bg-red-400 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {d}
            </button>
          ))}
          <span className="text-xs text-slate-400 self-center ml-1">+ more</span>
        </div>
      </div>

      {/* Effort scores */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">
          Effort
        </div>
        <div className="divide-y divide-slate-50">
          <RatingSelector
            label="Student Effort (self-rated)"
            value={effortStudentScore}
            readOnly
          />
          <RatingSelector
            label="Teacher Effort Rating"
            value={effortTeacherScore}
            onChange={onEffortTeacherChange}
          />
        </div>
      </div>

      {/* ATL subcategories */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">
          ATL Ratings
        </div>
        <div className="divide-y divide-slate-50">
          <RatingSelector
            label="Responsible & Prepared"
            value={responsiblePrepared}
            onChange={onResponsiblePreparedChange}
          />
          <RatingSelector
            label="Respectful & Works Well"
            value={respectfulWorks}
            onChange={onRespectfulWorksChange}
          />
        </div>
      </div>
    </div>
  )
}
