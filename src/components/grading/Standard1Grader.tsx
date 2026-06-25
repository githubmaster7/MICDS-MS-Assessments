'use client'

import { useMemo } from 'react'
import type { ActivitySkills } from '@/lib/skills/definitions'
import { calculateStandard1 } from '@/lib/grading/standard1'

type ColorScore = 1 | 2 | 3 | 4

const COLOR_LABELS: Record<ColorScore, string> = {
  1: 'Red',
  2: 'Yellow',
  3: 'Light Green',
  4: 'Bright Green',
}

const COLOR_BG_SELECTED: Record<ColorScore, string> = {
  1: 'bg-red-500 border-red-600 text-white',
  2: 'bg-yellow-400 border-yellow-500 text-yellow-900',
  3: 'bg-green-300 border-green-500 text-green-900',
  4: 'bg-emerald-500 border-emerald-600 text-white',
}

const COLOR_BG_UNSELECTED = 'bg-white border-slate-200 text-slate-400 hover:border-slate-400 hover:text-slate-600'

const SCORE_LABEL_COLORS: Record<ColorScore, string> = {
  1: 'bg-red-50 text-red-700 border-red-200',
  2: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  3: 'bg-green-50 text-green-700 border-green-200',
  4: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const LEGEND_ITEMS: { score: ColorScore; label: string; bg: string }[] = [
  { score: 1, label: 'Red', bg: 'bg-red-400' },
  { score: 2, label: 'Yellow', bg: 'bg-yellow-400' },
  { score: 3, label: 'Light Green', bg: 'bg-green-300' },
  { score: 4, label: 'Bright Green', bg: 'bg-emerald-500' },
]

interface SkillRowProps {
  name: string
  value: ColorScore
  onChange: (v: ColorScore) => void
}

function SkillRow({ name, value, onChange }: SkillRowProps) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-52 text-sm text-slate-700 leading-tight" title={name}>{name}</div>
      <div className="flex gap-1.5" role="radiogroup" aria-label={name}>
        {([1, 2, 3, 4] as ColorScore[]).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            aria-label={`${name}: ${COLOR_LABELS[v]}`}
            onClick={() => onChange(v)}
            className={`w-8 h-8 rounded border-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 ${
              value === v ? COLOR_BG_SELECTED[v] + ' scale-110 shadow-sm' : COLOR_BG_UNSELECTED
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${SCORE_LABEL_COLORS[value]}`}>
        {COLOR_LABELS[value]}
      </span>
    </div>
  )
}

interface Standard1GraderProps {
  activity: ActivitySkills | undefined
  skillScores: Record<string, ColorScore>
  onSkillChange: (skillName: string, score: ColorScore) => void
}

export function Standard1Grader({ activity, skillScores, onSkillChange }: Standard1GraderProps) {
  const getScore = (name: string): ColorScore => skillScores[name] ?? 2

  const allSkills = useMemo(() => {
    if (!activity) return []
    return [
      ...activity.fundamental.map((s) => ({ skillId: s.name, score: getScore(s.name) })),
      ...activity.specific.map((s) => ({ skillId: s.name, score: getScore(s.name) })),
    ]
  }, [activity, skillScores])

  const result = useMemo(() => {
    if (allSkills.length === 0) return null
    try { return calculateStandard1(allSkills) } catch { return null }
  }, [allSkills])

  const SCORE_BADGE_COLOR: Record<string, string> = {
    '4': 'bg-emerald-500 text-white',
    '3.5': 'bg-green-400 text-white',
    '3': 'bg-green-300 text-green-900',
    '2.5': 'bg-yellow-300 text-yellow-900',
    '2': 'bg-yellow-200 text-yellow-800',
    '1.5': 'bg-orange-300 text-orange-900',
    '1': 'bg-red-400 text-white',
  }

  if (!activity) {
    return <p className="text-sm text-slate-400 italic">No skill definitions for this activity.</p>
  }

  const total = allSkills.length

  return (
    <div>
      {/* Score display */}
      {result && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex-1">
            {/* Distribution bar */}
            <div className="flex h-3 rounded-full overflow-hidden gap-px mb-2">
              {result.breakdown.red > 0 && (
                <div className="bg-red-400" style={{ flex: result.breakdown.red }} title={`${result.breakdown.red} Red`} />
              )}
              {result.breakdown.yellow > 0 && (
                <div className="bg-yellow-400" style={{ flex: result.breakdown.yellow }} title={`${result.breakdown.yellow} Yellow`} />
              )}
              {result.breakdown.lightGreen > 0 && (
                <div className="bg-green-300" style={{ flex: result.breakdown.lightGreen }} title={`${result.breakdown.lightGreen} Light Green`} />
              )}
              {result.breakdown.brightGreen > 0 && (
                <div className="bg-emerald-500" style={{ flex: result.breakdown.brightGreen }} title={`${result.breakdown.brightGreen} Bright Green`} />
              )}
            </div>
            <div className="flex gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{result.breakdown.red}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />{result.breakdown.yellow}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-300 inline-block" />{result.breakdown.lightGreen}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{result.breakdown.brightGreen}</span>
              <span className="text-slate-400 ml-1">{total} total</span>
            </div>
          </div>
          <div className="text-center shrink-0">
            <div className="text-xs text-slate-500 mb-1">S1 Score</div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${SCORE_BADGE_COLOR[String(result.score)] ?? 'bg-slate-200 text-slate-700'}`}>
              {result.score}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-3 mb-4">
        {LEGEND_ITEMS.map(({ score, label, bg }) => (
          <div key={score} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`w-3 h-3 rounded-sm ${bg}`} />
            {label}
          </div>
        ))}
      </div>

      {/* Fundamental skills */}
      {activity.fundamental.length > 0 && (
        <div className="mb-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">
            Fundamental Movement Assessment
          </div>
          <div className="divide-y divide-slate-50">
            {activity.fundamental.map((skill) => (
              <SkillRow
                key={skill.name}
                name={skill.name}
                value={getScore(skill.name)}
                onChange={(v) => onSkillChange(skill.name, v)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Specific skills */}
      {activity.specific.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 pb-1 border-b border-slate-100">
            Specific Skill Assessment
          </div>
          <div className="divide-y divide-slate-50">
            {activity.specific.map((skill) => (
              <SkillRow
                key={skill.name}
                name={skill.name}
                value={getScore(skill.name)}
                onChange={(v) => onSkillChange(skill.name, v)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
