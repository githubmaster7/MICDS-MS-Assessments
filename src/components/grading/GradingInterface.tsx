'use client'
import { useState, useCallback } from 'react'
import { ACTIVITY_SKILLS } from '@/lib/skills/definitions'
import { calculateStandard1 } from '@/lib/grading/standard1'
import { calculateStandard234 } from '@/lib/grading/standards234'
import { calculateOverallGrade } from '@/lib/grading/conversion'

const SCORE_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4] as const
const SCORE_LABELS: Record<number, string> = {
  1: 'Beginning', 1.5: 'Beg+', 2: 'Developing', 2.5: 'Dev+',
  3: 'Proficient', 3.5: 'Prof+', 4: 'Advanced',
}
const COLOR_LABELS: Record<number, string> = {
  1: 'Red', 2: 'Yellow', 3: 'Light Green', 4: 'Bright Green',
}
const COLOR_CLASSES: Record<number, string> = {
  1: 'bg-red-100 border-red-400 text-red-800',
  2: 'bg-yellow-100 border-yellow-400 text-yellow-800',
  3: 'bg-green-100 border-green-400 text-green-800',
  4: 'bg-emerald-200 border-emerald-500 text-emerald-900',
}

type Student = {
  id: string
  firstName: string
  lastName: string
  currentGrade: string | null
  standard1Score: number | null
  standard2Score: number | null
  standard3Score: number | null
  standard4Score: number | null
}

export function GradingInterface({
  students,
  activityName,
  instanceId,
  teacherId,
}: {
  students: Student[]
  activityName: string
  instanceId: string
  teacherId: string
}) {
  const [selectedId, setSelectedId] = useState<string | null>(students[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  // Per-student skill scores for Standard 1
  const [skillScores, setSkillScores] = useState<Record<string, Record<string, 1 | 2 | 3 | 4>>>({})
  // Per-student teacher standard scores (2/3/4)
  const [teacherScores, setTeacherScores] = useState<Record<string, Record<number, number>>>({})
  // Per-student feedback
  const [feedback, setFeedback] = useState<Record<string, Record<number, string>>>({})
  const [feedbackVisible, setFeedbackVisible] = useState<Record<string, Record<number, boolean>>>({})

  const activity = ACTIVITY_SKILLS[activityName]
  const filtered = students.filter(
    (s) =>
      s.firstName.toLowerCase().includes(search.toLowerCase()) ||
      s.lastName.toLowerCase().includes(search.toLowerCase())
  )
  const selected = students.find((s) => s.id === selectedId)

  function getSkillScore(studentId: string, skillName: string): 1 | 2 | 3 | 4 {
    return skillScores[studentId]?.[skillName] ?? 2
  }

  function setSkillScore(studentId: string, skillName: string, score: 1 | 2 | 3 | 4) {
    setSkillScores((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? {}), [skillName]: score },
    }))
  }

  function calcStd1ForStudent(studentId: string) {
    if (!activity) return null
    const allSkills = [
      ...activity.fundamental.map((s) => ({ skillId: s.name, score: getSkillScore(studentId, s.name) })),
      ...activity.specific.map((s) => ({ skillId: s.name, score: getSkillScore(studentId, s.name) })),
    ]
    if (allSkills.length === 0) return null
    return calculateStandard1(allSkills)
  }

  function getTeacherScore(studentId: string, std: number): number {
    return teacherScores[studentId]?.[std] ?? 3
  }

  function setTeacherScore(studentId: string, std: number, score: number) {
    setTeacherScores((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? {}), [std]: score },
    }))
  }

  function calcOverall(studentId: string) {
    const s1 = calcStd1ForStudent(studentId)?.score
    const s2 = getTeacherScore(studentId, 2)
    const s3 = getTeacherScore(studentId, 3)
    const s4 = getTeacherScore(studentId, 4)
    if (!s1) return null
    try { return calculateOverallGrade({ s1, s2, s3, s4 }) } catch { return null }
  }

  const overall = selectedId ? calcOverall(selectedId) : null
  const std1Result = selectedId ? calcStd1ForStudent(selectedId) : null

  async function handleSave(studentId: string) {
    setSaving(true)
    try {
      const std1 = calcStd1ForStudent(studentId)
      const body = {
        studentId,
        instanceId,
        skillScores: skillScores[studentId] ?? {},
        standard1Score: std1?.score,
        standard2Score: getTeacherScore(studentId, 2),
        standard3Score: getTeacherScore(studentId, 3),
        standard4Score: getTeacherScore(studentId, 4),
        feedback: feedback[studentId] ?? {},
        feedbackVisible: feedbackVisible[studentId] ?? {},
      }
      const res = await fetch(`/api/teacher/grades/${studentId}/${instanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      setSaved(studentId)
      setTimeout(() => setSaved(null), 3000)
    } catch (e) {
      alert(`Save failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const gradeColor: Record<string, string> = {
    A: 'text-emerald-700', 'A-': 'text-emerald-600',
    'B+': 'text-blue-700', B: 'text-blue-600', 'B-': 'text-blue-500',
    'C+': 'text-yellow-700', C: 'text-yellow-600', 'C-': 'text-orange-600',
    'D+': 'text-orange-700', D: 'text-red-600', 'D-': 'text-red-700', F: 'text-red-800',
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-160px)]">
      {/* Student list */}
      <div className="w-72 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-100">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students…"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((s) => {
            const liveOverall = calcOverall(s.id)
            const grade = liveOverall?.letterGrade ?? s.currentGrade ?? '—'
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-50 transition-colors ${selectedId === s.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
              >
                <div>
                  <div className="font-medium text-sm text-gray-900">{s.firstName} {s.lastName}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {saved === s.id ? <span className="text-green-600">✓ Saved</span> : ''}
                  </div>
                </div>
                <span className={`text-sm font-bold ${gradeColor[grade] ?? 'text-gray-500'}`}>{grade}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Grading panel */}
      {selected ? (
        <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">{selected.firstName} {selected.lastName}</h2>
              <p className="text-sm text-gray-500">{activityName}</p>
            </div>
            <div className="flex items-center gap-3">
              {overall && (
                <div className="text-center">
                  <div className={`text-2xl font-bold ${gradeColor[overall.letterGrade] ?? 'text-gray-700'}`}>
                    {overall.letterGrade}
                  </div>
                  <div className="text-xs text-gray-400">Overall</div>
                </div>
              )}
              <button
                onClick={() => handleSave(selected.id)}
                disabled={saving}
                className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : saved === selected.id ? '✓ Saved' : 'Save'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Standard 1 */}
            <section>
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                Standard 1: Movement Skills
                {std1Result && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-sm">
                    Score: {std1Result.score}
                  </span>
                )}
              </h3>

              {activity?.fundamental && activity.fundamental.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Fundamental Movement Assessment
                  </div>
                  <div className="space-y-2">
                    {activity.fundamental.map((skill) => (
                      <SkillRow
                        key={skill.name}
                        skillName={skill.name}
                        value={getSkillScore(selected.id, skill.name)}
                        onChange={(v) => setSkillScore(selected.id, skill.name, v)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activity?.specific && activity.specific.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Specific Skill Assessment
                  </div>
                  <div className="space-y-2">
                    {activity.specific.map((skill) => (
                      <SkillRow
                        key={skill.name}
                        skillName={skill.name}
                        value={getSkillScore(selected.id, skill.name)}
                        onChange={(v) => setSkillScore(selected.id, skill.name, v)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {std1Result && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 flex gap-4">
                  <span>🔴 {std1Result.breakdown.red} Red</span>
                  <span>🟡 {std1Result.breakdown.yellow} Yellow</span>
                  <span>🟢 {std1Result.breakdown.lightGreen} Light Green</span>
                  <span>✅ {std1Result.breakdown.brightGreen} Bright Green</span>
                  <span className="font-semibold">→ Score: {std1Result.score}</span>
                </div>
              )}
            </section>

            {/* Standards 2-4 */}
            {([2, 3, 4] as const).map((stdNum) => (
              <StandardScorer
                key={stdNum}
                standardNumber={stdNum}
                studentId={selected.id}
                score={getTeacherScore(selected.id, stdNum)}
                onScoreChange={(v) => setTeacherScore(selected.id, stdNum, v)}
                feedbackText={feedback[selected.id]?.[stdNum] ?? ''}
                onFeedbackChange={(v) =>
                  setFeedback((prev) => ({
                    ...prev,
                    [selected.id]: { ...(prev[selected.id] ?? {}), [stdNum]: v },
                  }))
                }
                isFeedbackVisible={feedbackVisible[selected.id]?.[stdNum] ?? false}
                onVisibleChange={(v) =>
                  setFeedbackVisible((prev) => ({
                    ...prev,
                    [selected.id]: { ...(prev[selected.id] ?? {}), [stdNum]: v },
                  }))
                }
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white rounded-xl border border-gray-200 flex items-center justify-center text-gray-400">
          Select a student to grade
        </div>
      )}
    </div>
  )
}

function SkillRow({
  skillName,
  value,
  onChange,
}: {
  skillName: string
  value: 1 | 2 | 3 | 4
  onChange: (v: 1 | 2 | 3 | 4) => void
}) {
  const COLOR_BG: Record<number, string> = {
    1: 'bg-red-500', 2: 'bg-yellow-400', 3: 'bg-green-300', 4: 'bg-emerald-500',
  }
  return (
    <div className="flex items-center gap-3">
      <div className="w-48 text-sm text-gray-700 truncate" title={skillName}>{skillName}</div>
      <div className="flex gap-1">
        {([1, 2, 3, 4] as const).map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            title={`${v} – ${COLOR_LABELS[v]}`}
            aria-label={`${skillName}: ${COLOR_LABELS[v]}`}
            className={`w-9 h-9 rounded border-2 text-xs font-bold transition-all ${
              value === v
                ? `${COLOR_BG[v]} border-gray-600 text-white scale-110`
                : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <div className={`px-2 py-0.5 rounded text-xs font-medium border ${COLOR_CLASSES[value]}`}>
        {COLOR_LABELS[value]}
      </div>
    </div>
  )
}

const STANDARD_NAMES: Record<number, string> = {
  2: 'Standard 2: Movement Concepts & Sport Strategies',
  3: 'Standard 3: Health, Fitness & Nutrition',
  4: 'Standard 4: Teamwork & Leadership',
}

function StandardScorer({
  standardNumber,
  studentId,
  score,
  onScoreChange,
  feedbackText,
  onFeedbackChange,
  isFeedbackVisible,
  onVisibleChange,
}: {
  standardNumber: number
  studentId: string
  score: number
  onScoreChange: (v: number) => void
  feedbackText: string
  onFeedbackChange: (v: string) => void
  isFeedbackVisible: boolean
  onVisibleChange: (v: boolean) => void
}) {
  const scoreColor: Record<number, string> = {
    4: 'text-emerald-700', 3.5: 'text-green-700', 3: 'text-green-600',
    2.5: 'text-yellow-700', 2: 'text-yellow-600', 1.5: 'text-orange-600', 1: 'text-red-600',
  }
  return (
    <section className="border-t border-gray-100 pt-4">
      <h3 className="font-semibold text-gray-800 mb-3">{STANDARD_NAMES[standardNumber]}</h3>
      <div className="flex items-center gap-3 mb-3">
        <label className="text-sm text-gray-600">Teacher Score:</label>
        <div className="flex gap-1 flex-wrap">
          {SCORE_OPTIONS.map((v) => (
            <button
              key={v}
              onClick={() => onScoreChange(v)}
              className={`px-3 py-1 rounded border text-sm font-medium transition-all ${
                score === v
                  ? `border-gray-600 bg-gray-800 text-white`
                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <span className={`text-sm font-semibold ${scoreColor[score] ?? ''}`}>
          {SCORE_LABELS[score]}
        </span>
      </div>
      <div className="mt-2">
        <label className="text-sm text-gray-600 block mb-1">Feedback:</label>
        <textarea
          value={feedbackText}
          onChange={(e) => onFeedbackChange(e.target.value)}
          rows={2}
          placeholder="Optional teacher feedback…"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        />
        <label className="flex items-center gap-2 mt-1 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={isFeedbackVisible}
            onChange={(e) => onVisibleChange(e.target.checked)}
            className="rounded"
          />
          Visible to student
        </label>
      </div>
    </section>
  )
}
