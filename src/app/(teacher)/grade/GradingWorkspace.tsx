'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { ACTIVITY_SKILLS } from '@/lib/skills/definitions'
import { calculateStandard1 } from '@/lib/grading/standard1'
import { calculateOverallGrade } from '@/lib/grading/conversion'
import { calculateApproachToLearning, calculateDaysLateScore } from '@/lib/grading/approach-to-learning'
import { Standard1Grader } from '@/components/grading/Standard1Grader'
import { Standard234Grader, type ValidScore } from '@/components/grading/Standard234Grader'
import { Standard4SelfRating } from '@/components/grading/Standard4SelfRating'
import { ATLGrader } from '@/components/grading/ATLGrader'

type ColorScore = 1 | 2 | 3 | 4

const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald-700 bg-emerald-50 border-emerald-300',
  'A-': 'text-emerald-600 bg-emerald-50 border-emerald-200',
  'B+': 'text-blue-700 bg-blue-50 border-blue-300',
  B: 'text-blue-600 bg-blue-50 border-blue-200',
  'B-': 'text-blue-500 bg-blue-50 border-blue-200',
  'C+': 'text-amber-700 bg-amber-50 border-amber-300',
  C: 'text-amber-600 bg-amber-50 border-amber-200',
  'C-': 'text-orange-600 bg-orange-50 border-orange-200',
  'D+': 'text-orange-700 bg-orange-50 border-orange-200',
  D: 'text-red-600 bg-red-50 border-red-200',
  'D-': 'text-red-700 bg-red-50 border-red-200',
  F: 'text-red-900 bg-red-50 border-red-300',
}

const SCORE_LABEL_COLORS: Record<number, string> = {
  1: 'text-red-600',
  1.5: 'text-red-500',
  2: 'text-yellow-700',
  2.5: 'text-yellow-600',
  3: 'text-green-700',
  3.5: 'text-green-600',
  4: 'text-emerald-700',
}

type FilterType = 'all' | 'incomplete' | 'graded'

interface Student {
  id: string
  firstName: string
  lastName: string
  currentGrade: string | null
  standard1Score: number | null
  standard2Score: number | null
  standard3Score: number | null
  standard4Score: number | null
  standard4SelfRating: number | null
  daysLateUnprepared: number
  effortTeacherScore: number | null
  responsiblePrepared: number | null
  respectfulWorks: number | null
  lastSaved: Date | null
}

const TABS = ['Standard 1', 'Standard 2', 'Standard 3', 'Standard 4', 'ATL'] as const
type Tab = typeof TABS[number]

export function GradingWorkspace({
  students,
  activityName,
  instanceId,
}: {
  students: Student[]
  activityName: string
  instanceId: string
}) {
  const [selectedId, setSelectedId] = useState<string | null>(students[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [activeTab, setActiveTab] = useState<Tab>('Standard 1')
  const [saving, setSaving] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [unsavedIds, setUnsavedIds] = useState<Set<string>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)

  // Per-student state
  const [skillScores, setSkillScores] = useState<Record<string, Record<string, ColorScore>>>({})
  const [teacherScores, setTeacherScores] = useState<Record<string, Record<2 | 3 | 4, ValidScore>>>({})
  const [feedback, setFeedback] = useState<Record<string, Record<number, string>>>({})
  const [feedbackVisible, setFeedbackVisible] = useState<Record<string, Record<number, boolean>>>({})
  const [std4TeacherRating, setStd4TeacherRating] = useState<Record<string, ColorScore>>({})
  const [daysLate, setDaysLate] = useState<Record<string, number>>({})
  const [effortTeacher, setEffortTeacher] = useState<Record<string, ColorScore>>({})
  const [responsiblePrep, setResponsiblePrep] = useState<Record<string, ColorScore>>({})
  const [respectfulWorks, setRespectfulWorks] = useState<Record<string, ColorScore>>({})

  const activity = ACTIVITY_SKILLS[activityName]

  // Keyboard: / to focus search, arrow keys for navigation
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const active = document.activeElement
      if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const idx = filteredStudents.findIndex((s) => s.id === selectedId)
        if (idx === -1) return
        const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1
        if (next >= 0 && next < filteredStudents.length) {
          setSelectedId(filteredStudents[next].id)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  function markUnsaved(id: string) {
    setUnsavedIds((prev) => new Set([...prev, id]))
    setSavedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
  }

  function getSkillScore(sid: string, name: string): ColorScore {
    return skillScores[sid]?.[name] ?? 2
  }

  function setSkillScore(sid: string, name: string, score: ColorScore) {
    setSkillScores((prev) => ({ ...prev, [sid]: { ...(prev[sid] ?? {}), [name]: score } }))
    markUnsaved(sid)
  }

  function getTeacherScore(sid: string, std: 2 | 3 | 4): ValidScore {
    return teacherScores[sid]?.[std] ?? 3
  }

  function setTeacherScore(sid: string, std: 2 | 3 | 4, score: ValidScore) {
    setTeacherScores((prev) => ({ ...prev, [sid]: { ...(prev[sid] ?? {}), [std]: score } }))
    markUnsaved(sid)
  }

  function calcStd1(sid: string) {
    if (!activity) return null
    const skills = [
      ...activity.fundamental.map((s) => ({ skillId: s.name, score: getSkillScore(sid, s.name) })),
      ...activity.specific.map((s) => ({ skillId: s.name, score: getSkillScore(sid, s.name) })),
    ]
    if (skills.length === 0) return null
    try { return calculateStandard1(skills) } catch { return null }
  }

  function calcOverall(sid: string) {
    const s1 = calcStd1(sid)?.score
    const s2 = getTeacherScore(sid, 2)
    const s3 = getTeacherScore(sid, 3)
    const s4 = getTeacherScore(sid, 4)
    if (!s1) return null
    try { return calculateOverallGrade({ s1, s2, s3, s4 }) } catch { return null }
  }

  const filteredStudents = students.filter((s) => {
    const name = `${s.firstName} ${s.lastName}`.toLowerCase()
    if (!name.includes(search.toLowerCase())) return false
    if (filter === 'incomplete') return !s.currentGrade && !savedIds.has(s.id)
    if (filter === 'graded') return !!s.currentGrade || savedIds.has(s.id)
    return true
  })

  const selected = students.find((s) => s.id === selectedId)
  const std1Result = selectedId ? calcStd1(selectedId) : null
  const overall = selectedId ? calcOverall(selectedId) : null

  async function handleSave(sid: string) {
    setSaving(true)
    try {
      const std1 = calcStd1(sid)
      const body = {
        studentId: sid,
        instanceId,
        skillScores: skillScores[sid] ?? {},
        standard1Score: std1?.score ?? null,
        standard2Score: getTeacherScore(sid, 2),
        standard3Score: getTeacherScore(sid, 3),
        standard4Score: getTeacherScore(sid, 4),
        standard4TeacherRating: std4TeacherRating[sid] ?? 3,
        daysLateUnprepared: daysLate[sid] ?? 0,
        effortTeacherScore: effortTeacher[sid] ?? 3,
        responsiblePrepared: responsiblePrep[sid] ?? 3,
        respectfulWorks: respectfulWorks[sid] ?? 3,
        feedback: feedback[sid] ?? {},
        feedbackVisible: feedbackVisible[sid] ?? {},
      }
      const res = await fetch(`/api/teacher/grades/${sid}/${instanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      setSavedIds((prev) => new Set([...prev, sid]))
      setUnsavedIds((prev) => { const n = new Set(prev); n.delete(sid); return n })
    } catch (e) {
      alert(`Save failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full">
      {/* Student list */}
      <div className="w-64 shrink-0 flex flex-col border-r border-slate-200 bg-white">
        {/* Search + filter */}
        <div className="p-3 border-b border-slate-100 space-y-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-2.5 text-slate-400" width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search (press /)"
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'incomplete', 'graded'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 px-1 py-1 rounded text-xs font-medium capitalize transition-colors ${
                  filter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filteredStudents.length === 0 && (
            <div className="p-4 text-sm text-slate-400 text-center">No students match.</div>
          )}
          {filteredStudents.map((s) => {
            const liveOverall = calcOverall(s.id)
            const grade = liveOverall?.letterGrade ?? s.currentGrade
            const isSelected = selectedId === s.id
            const hasUnsaved = unsavedIds.has(s.id)
            const hasSaved = savedIds.has(s.id)

            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-left border-b border-slate-50 transition-colors ${
                  isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {s.firstName} {s.lastName}
                  </div>
                  <div className="text-xs mt-0.5">
                    {hasSaved ? (
                      <span className="text-emerald-600">Saved</span>
                    ) : hasUnsaved ? (
                      <span className="text-amber-600">Unsaved changes</span>
                    ) : s.lastSaved ? (
                      <span className="text-slate-400">Graded</span>
                    ) : (
                      <span className="text-slate-300">Not graded</span>
                    )}
                  </div>
                </div>
                {grade ? (
                  <span className={`ml-2 text-sm font-bold px-1.5 py-0.5 rounded border ${GRADE_COLORS[grade] ?? 'text-slate-600'}`}>
                    {grade}
                  </span>
                ) : (
                  <span className="ml-2 text-sm text-slate-300">—</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Count */}
        <div className="shrink-0 px-3 py-2 border-t border-slate-100 text-xs text-slate-400">
          {filteredStudents.length} of {students.length} students
          {unsavedIds.size > 0 && (
            <span className="text-amber-600 ml-2">{unsavedIds.size} unsaved</span>
          )}
        </div>
      </div>

      {/* Grading panel */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Student header */}
          <div className="shrink-0 px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-semibold text-sm shrink-0">
                {selected.firstName[0]}{selected.lastName[0]}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900">{selected.firstName} {selected.lastName}</div>
                <div className="text-xs text-slate-500">
                  Use <kbd className="px-1 bg-slate-100 rounded text-slate-600 border border-slate-200">↑↓</kbd> to navigate students
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {unsavedIds.has(selected.id) && (
                <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
              )}
              {savedIds.has(selected.id) && (
                <span className="text-xs text-emerald-600 font-medium">Saved</span>
              )}
              <button
                onClick={() => handleSave(selected.id)}
                disabled={saving}
                className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {saving ? 'Saving…' : 'Save All'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="shrink-0 border-b border-slate-200 bg-white px-5 flex gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const isActive = activeTab === tab
              let score: number | null = null
              if (tab === 'Standard 1') score = std1Result?.score ?? null
              if (tab === 'Standard 2') score = getTeacherScore(selected.id, 2)
              if (tab === 'Standard 3') score = getTeacherScore(selected.id, 3)
              if (tab === 'Standard 4') score = getTeacherScore(selected.id, 4)
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap focus-visible:outline-none ${
                    isActive
                      ? 'border-blue-600 text-blue-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab}
                  {score != null && tab !== 'ATL' && (
                    <span className={`ml-1.5 text-xs tabular-nums ${isActive ? 'text-blue-600' : SCORE_LABEL_COLORS[score] ?? 'text-slate-500'}`}>
                      {score}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === 'Standard 1' && (
              <Standard1Grader
                activity={activity}
                skillScores={skillScores[selected.id] ?? {}}
                onSkillChange={(name, score) => setSkillScore(selected.id, name, score)}
              />
            )}

            {(activeTab === 'Standard 2' || activeTab === 'Standard 3') && (() => {
              const std = activeTab === 'Standard 2' ? 2 : 3
              return (
                <Standard234Grader
                  standardNumber={std as 2 | 3}
                  teacherScore={getTeacherScore(selected.id, std as 2 | 3)}
                  onScoreChange={(v) => setTeacherScore(selected.id, std as 2 | 3, v)}
                  feedbackText={feedback[selected.id]?.[std] ?? ''}
                  onFeedbackChange={(v) =>
                    setFeedback((prev) => ({ ...prev, [selected.id]: { ...(prev[selected.id] ?? {}), [std]: v } }))
                  }
                  isFeedbackVisible={feedbackVisible[selected.id]?.[std] ?? false}
                  onVisibleChange={(v) => {
                    setFeedbackVisible((prev) => ({ ...prev, [selected.id]: { ...(prev[selected.id] ?? {}), [std]: v } }))
                    markUnsaved(selected.id)
                  }}
                />
              )
            })()}

            {activeTab === 'Standard 4' && (
              <div className="space-y-6">
                <Standard4SelfRating
                  studentRating={(selected.standard4SelfRating as ColorScore) ?? 3}
                  teacherRating={std4TeacherRating[selected.id] ?? (selected.standard4Score as ColorScore) ?? 3}
                  onTeacherRatingChange={(v) => {
                    setStd4TeacherRating((prev) => ({ ...prev, [selected.id]: v }))
                    markUnsaved(selected.id)
                  }}
                />
                <Standard234Grader
                  standardNumber={4}
                  teacherScore={getTeacherScore(selected.id, 4)}
                  onScoreChange={(v) => setTeacherScore(selected.id, 4, v)}
                  feedbackText={feedback[selected.id]?.[4] ?? ''}
                  onFeedbackChange={(v) =>
                    setFeedback((prev) => ({ ...prev, [selected.id]: { ...(prev[selected.id] ?? {}), [4]: v } }))
                  }
                  isFeedbackVisible={feedbackVisible[selected.id]?.[4] ?? false}
                  onVisibleChange={(v) => {
                    setFeedbackVisible((prev) => ({ ...prev, [selected.id]: { ...(prev[selected.id] ?? {}), [4]: v } }))
                    markUnsaved(selected.id)
                  }}
                />
              </div>
            )}

            {activeTab === 'ATL' && (
              <ATLGrader
                daysLate={daysLate[selected.id] ?? (selected.daysLateUnprepared ?? 0)}
                onDaysLateChange={(v) => {
                  setDaysLate((prev) => ({ ...prev, [selected.id]: v }))
                  markUnsaved(selected.id)
                }}
                effortStudentScore={3}
                effortTeacherScore={effortTeacher[selected.id] ?? (selected.effortTeacherScore as ColorScore) ?? 3}
                onEffortTeacherChange={(v) => {
                  setEffortTeacher((prev) => ({ ...prev, [selected.id]: v }))
                  markUnsaved(selected.id)
                }}
                responsiblePrepared={responsiblePrep[selected.id] ?? (selected.responsiblePrepared as ColorScore) ?? 3}
                onResponsiblePreparedChange={(v) => {
                  setResponsiblePrep((prev) => ({ ...prev, [selected.id]: v }))
                  markUnsaved(selected.id)
                }}
                respectfulWorks={respectfulWorks[selected.id] ?? (selected.respectfulWorks as ColorScore) ?? 3}
                onRespectfulWorksChange={(v) => {
                  setRespectfulWorks((prev) => ({ ...prev, [selected.id]: v }))
                  markUnsaved(selected.id)
                }}
              />
            )}
          </div>

          {/* Overall grade bar */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3">
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">Overall Grade</span>
              <div className="flex gap-3 flex-1 min-w-0 overflow-x-auto">
                {(['S1', 'S2', 'S3', 'S4'] as const).map((label, i) => {
                  const scores = [
                    std1Result?.score,
                    getTeacherScore(selected.id, 2),
                    getTeacherScore(selected.id, 3),
                    getTeacherScore(selected.id, 4),
                  ]
                  const score = scores[i]
                  return (
                    <div key={label} className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-slate-400">{label}</span>
                      <span className={`text-sm font-bold tabular-nums ${score != null ? SCORE_LABEL_COLORS[score] : 'text-slate-300'}`}>
                        {score ?? '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
              {overall ? (
                <div className={`shrink-0 text-xl font-bold px-3 py-1 rounded-lg border-2 ${GRADE_COLORS[overall.letterGrade] ?? 'text-slate-700'}`}>
                  {overall.letterGrade}
                </div>
              ) : (
                <div className="shrink-0 text-xl font-bold text-slate-300 px-3 py-1">—</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-400">
            <div className="text-4xl mb-3">👆</div>
            <p className="text-sm">Select a student from the list to begin grading</p>
            <p className="text-xs mt-1">Press <kbd className="px-1 bg-slate-100 rounded text-slate-500 border border-slate-200">/</kbd> to search</p>
          </div>
        </div>
      )}
    </div>
  )
}
