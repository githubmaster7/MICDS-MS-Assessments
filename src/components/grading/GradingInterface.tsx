'use client'
import { useState } from 'react'
import { calculateStandard1 } from '@/lib/grading/standard1'
import { calculateStandard234 } from '@/lib/grading/standards234'
import { calculateApproachToLearning, calculateDaysLateScore } from '@/lib/grading/approach-to-learning'
import { calculateOverallGrade } from '@/lib/grading/conversion'

type Score = 1 | 2 | 3 | 4

const COLOR_LABELS: Record<Score, string> = {
  1: 'Red',
  2: 'Yellow',
  3: 'Light Green',
  4: 'Bright Green',
}
const COLOR_CLASSES: Record<Score, string> = {
  1: 'bg-red-100 border-red-400 text-red-800',
  2: 'bg-yellow-100 border-yellow-400 text-yellow-800',
  3: 'bg-green-100 border-green-400 text-green-800',
  4: 'bg-emerald-200 border-emerald-500 text-emerald-900',
}
const COLOR_BG: Record<Score, string> = {
  1: 'bg-red-500',
  2: 'bg-yellow-400',
  3: 'bg-green-300',
  4: 'bg-emerald-500',
}
const SCORE_BADGE_COLOR: Record<string, string> = {
  '4': 'bg-emerald-500 text-white',
  '3.5': 'bg-green-400 text-white',
  '3': 'bg-green-300 text-green-900',
  '2.5': 'bg-yellow-300 text-yellow-900',
  '2': 'bg-yellow-200 text-yellow-800',
  '1.5': 'bg-orange-300 text-orange-900',
  '1': 'bg-red-400 text-white',
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Student {
  id: string
  firstName: string
  lastName: string
  currentGrade: string | null
}

export interface SkillDefinition {
  id: string
  skillName: string
  skillType: 'FUNDAMENTAL' | 'SPECIFIC'
  displayOrder: number
}

export interface PromptDef {
  id: string
  promptText: string
  displayOrder: number
}

export interface AtlData {
  responsiblePrepared: Score | null
  respectfulWorks: Score | null
  effortTeacherScore: Score | null
  effortStudentScore: Score | null
  daysLateUnprepared: number
  calculatedScore: number | null
}

export interface HistoryAttempt {
  attemptNumber: number
  submittedAt: string
  writtenResponses: { promptDefinitionId: string; responseText: string }[]
  skillSelfRatings: { skillDefinitionId: string; rating: number }[]
  promptSelfRatings: { promptDefinitionId: string; rating: number }[]
  standard4SelfRating: Score | null
}

export interface GradeHistoryEntry {
  id: string
  createdAt: string
  actorEmail: string | null
  beforeValue: { score?: number | null; feedback?: string | null } | null
  afterValue: { score?: number | null; feedback?: string | null } | null
}

export interface StudentGradeData {
  skillScores: Record<string, Score>
  promptScores: Record<string, Score>
  skillSelfRatings: Record<string, Score>
  promptSelfRatings: Record<string, Score>
  standard4TeacherRating: Score | null
  standard4StudentSelfRating: Score | null
  standardScores: Record<1 | 2 | 3 | 4, number | null>
  feedback: Record<1 | 2 | 3 | 4, string>
  feedbackVisible: Record<1 | 2 | 3 | 4, boolean>
  writtenResponses: Record<string, { text: string }>
  submissionStatus: Record<1 | 2 | 3 | 4, string | null>
  attemptCount: Record<1 | 2 | 3 | 4, number>
  history: Record<1 | 2 | 3 | 4, HistoryAttempt[]>
  gradeHistory: Record<1 | 2 | 3 | 4, GradeHistoryEntry[]>
  atl: AtlData
}

export type GradeDataByStudent = Record<string, StudentGradeData>

interface GradingInterfaceProps {
  students: Student[]
  activityName: string
  instanceId: string
  skillDefinitions: SkillDefinition[]
  promptsByStandard: Record<2 | 3 | 4, PromptDef[]>
  gradeData: GradeDataByStudent
}

const STANDARD_NAMES: Record<1 | 2 | 3 | 4, string> = {
  1: 'Standard 1: Movement Skills',
  2: 'Standard 2: Movement Concepts & Sport Strategies',
  3: 'Standard 3: Health, Fitness & Nutrition',
  4: 'Standard 4: Teamwork & Leadership',
}

const SUBMISSION_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Not started',
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  REASSESSMENT_SUBMITTED: 'Resubmitted',
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GradingInterface({
  students,
  activityName,
  instanceId,
  skillDefinitions,
  promptsByStandard,
  gradeData,
}: GradingInterfaceProps) {
  const [selectedId, setSelectedId] = useState<string | null>(students[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [data, setData] = useState<GradeDataByStudent>(gradeData)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [historyStandard, setHistoryStandard] = useState<1 | 2 | 3 | 4 | null>(null)
  const [gradeHistoryStandard, setGradeHistoryStandard] = useState<1 | 2 | 3 | 4 | null>(null)

  const fundamentalSkills = skillDefinitions.filter((s) => s.skillType === 'FUNDAMENTAL')
  const specificSkills = skillDefinitions.filter((s) => s.skillType === 'SPECIFIC')

  const skillNameById = Object.fromEntries(skillDefinitions.map((s) => [s.id, s.skillName]))
  const promptTextById = Object.fromEntries(
    ([2, 3, 4] as const).flatMap((std) => promptsByStandard[std].map((p) => [p.id, p.promptText])),
  )

  const filtered = students.filter(
    (s) =>
      s.firstName.toLowerCase().includes(search.toLowerCase()) ||
      s.lastName.toLowerCase().includes(search.toLowerCase()),
  )
  const selected = students.find((s) => s.id === selectedId)
  const selectedData = selectedId ? data[selectedId] : undefined

  function updateStudent(studentId: string, updater: (d: StudentGradeData) => StudentGradeData) {
    setData((prev) => ({ ...prev, [studentId]: updater(prev[studentId]) }))
  }

  function calcStandard1(d: StudentGradeData) {
    const items = skillDefinitions
      .filter((s) => d.skillScores[s.id] !== undefined)
      .map((s) => ({ skillId: s.id, score: d.skillScores[s.id] }))
    if (items.length === 0) return null
    return calculateStandard1(items)
  }

  function calcStandard23(d: StudentGradeData, std: 2 | 3) {
    const prompts = promptsByStandard[std]
    const items = prompts
      .filter((p) => d.promptScores[p.id] !== undefined)
      .map((p) => ({ itemId: p.id, score: d.promptScores[p.id] }))
    if (items.length === 0) return null
    return calculateStandard234(items)
  }

  function calcStandard4(d: StudentGradeData) {
    const prompts = promptsByStandard[4]
    const items: { itemId: string; score: Score }[] = prompts
      .filter((p) => d.promptScores[p.id] !== undefined)
      .map((p) => ({ itemId: p.id, score: d.promptScores[p.id] }))
    if (d.standard4TeacherRating !== null) {
      items.push({ itemId: 'teacher-rating', score: d.standard4TeacherRating })
    }
    if (d.standard4StudentSelfRating !== null) {
      items.push({ itemId: 'student-self-rating', score: d.standard4StudentSelfRating })
    }
    if (items.length === 0) return null
    return calculateStandard234(items)
  }

  function calcAtl(d: StudentGradeData) {
    if (
      d.atl.responsiblePrepared === null ||
      d.atl.respectfulWorks === null ||
      d.atl.effortTeacherScore === null ||
      d.atl.effortStudentScore === null
    ) {
      return null
    }
    try {
      return calculateApproachToLearning({
        responsiblePrepared: d.atl.responsiblePrepared,
        respectfulWorks: d.atl.respectfulWorks,
        effortTeacherScore: d.atl.effortTeacherScore,
        effortStudentScore: d.atl.effortStudentScore,
        daysLateUnprepared: d.atl.daysLateUnprepared,
      })
    } catch {
      return null
    }
  }

  function buildCurrentAttempt(d: StudentGradeData, std: 1 | 2 | 3 | 4): HistoryAttempt {
    const prompts = std === 1 ? [] : promptsByStandard[std]
    return {
      attemptNumber: d.attemptCount[std] || 1,
      submittedAt: new Date().toISOString(),
      writtenResponses: prompts
        .filter((p) => d.writtenResponses[p.id])
        .map((p) => ({ promptDefinitionId: p.id, responseText: d.writtenResponses[p.id].text })),
      skillSelfRatings:
        std === 1
          ? skillDefinitions
              .filter((s) => d.skillSelfRatings[s.id] !== undefined)
              .map((s) => ({ skillDefinitionId: s.id, rating: d.skillSelfRatings[s.id] }))
          : [],
      promptSelfRatings:
        std === 2 || std === 3
          ? prompts
              .filter((p) => d.promptSelfRatings[p.id] !== undefined)
              .map((p) => ({ promptDefinitionId: p.id, rating: d.promptSelfRatings[p.id] }))
          : [],
      standard4SelfRating: std === 4 ? d.standard4StudentSelfRating : null,
    }
  }

  function calcOverall(d: StudentGradeData) {
    const s1 = calcStandard1(d)?.score
    const s2 = calcStandard23(d, 2)?.score
    const s3 = calcStandard23(d, 3)?.score
    const s4 = calcStandard4(d)?.score
    if (!s1 || !s2 || !s3 || !s4) return null
    try {
      return calculateOverallGrade({ s1, s2, s3, s4 })
    } catch {
      return null
    }
  }

  const std1Result = selectedData ? calcStandard1(selectedData) : null
  const std2Result = selectedData ? calcStandard23(selectedData, 2) : null
  const std3Result = selectedData ? calcStandard23(selectedData, 3) : null
  const std4Result = selectedData ? calcStandard4(selectedData) : null
  const atlResult = selectedData ? calcAtl(selectedData) : null
  const overall = selectedData ? calcOverall(selectedData) : null

  async function putStandard(studentId: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/teacher/grades/${studentId}/${instanceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error ?? `Failed to save standard ${body.standardNumber}`)
    }
  }

  async function putAtl(studentId: string, d: StudentGradeData) {
    if (
      d.atl.responsiblePrepared === null &&
      d.atl.respectfulWorks === null &&
      d.atl.effortTeacherScore === null
    ) {
      return
    }
    const res = await fetch(`/api/teacher/approach-to-learning/${studentId}/${instanceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        responsiblePrepared: d.atl.responsiblePrepared ?? undefined,
        respectfulWorks: d.atl.respectfulWorks ?? undefined,
        effortTeacherScore: d.atl.effortTeacherScore ?? undefined,
        daysLateUnprepared: d.atl.daysLateUnprepared,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Failed to save Approach to Learning')
    }
  }

  async function handleSave(studentId: string) {
    const d = data[studentId]
    setSaving(true)
    setError(null)
    try {
      const ratedSkills = skillDefinitions.filter((s) => d.skillScores[s.id] !== undefined)
      if (ratedSkills.length > 0) {
        await putStandard(studentId, {
          standardNumber: 1,
          skillScores: ratedSkills.map((s) => ({ skillDefinitionId: s.id, score: d.skillScores[s.id] })),
          feedback: d.feedback[1] || null,
          isFeedbackStudentVisible: d.feedbackVisible[1],
        })
      }

      for (const std of [2, 3] as const) {
        const ratedPrompts = promptsByStandard[std].filter((p) => d.promptScores[p.id] !== undefined)
        if (ratedPrompts.length === 0) continue
        await putStandard(studentId, {
          standardNumber: std,
          promptScores: ratedPrompts.map((p) => ({ promptDefinitionId: p.id, score: d.promptScores[p.id] })),
          feedback: d.feedback[std] || null,
          isFeedbackStudentVisible: d.feedbackVisible[std],
        })
      }

      const ratedStd4Prompts = promptsByStandard[4].filter((p) => d.promptScores[p.id] !== undefined)
      if (ratedStd4Prompts.length > 0 || d.standard4TeacherRating !== null) {
        await putStandard(studentId, {
          standardNumber: 4,
          promptScores: ratedStd4Prompts.map((p) => ({ promptDefinitionId: p.id, score: d.promptScores[p.id] })),
          standard4Rating: d.standard4TeacherRating ?? undefined,
          feedback: d.feedback[4] || null,
          isFeedbackStudentVisible: d.feedbackVisible[4],
        })
      }

      await putAtl(studentId, d)

      // Reflect freshly computed scores locally so the sidebar/grade badges
      // update without a full page reload.
      updateStudent(studentId, (prev) => ({
        ...prev,
        standardScores: {
          1: calcStandard1(prev)?.score ?? prev.standardScores[1],
          2: calcStandard23(prev, 2)?.score ?? prev.standardScores[2],
          3: calcStandard23(prev, 3)?.score ?? prev.standardScores[3],
          4: calcStandard4(prev)?.score ?? prev.standardScores[4],
        },
      }))

      setSaved(studentId)
      setTimeout(() => setSaved(null), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
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
            const liveOverall = calcOverall(data[s.id])
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
      {selected && selectedData ? (
        <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
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

          {error && (
            <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-8">
            {/* Standard 1 */}
            <section>
              <SectionHeader
                title={STANDARD_NAMES[1]}
                result={std1Result}
                attemptCount={selectedData.attemptCount[1]}
                hasSubmission={selectedData.submissionStatus[1] !== null}
                onViewHistory={() => setHistoryStandard(1)}
                onViewGradeHistory={() => setGradeHistoryStandard(1)}
                gradeHistoryCount={selectedData.gradeHistory[1].length}
              />

              {fundamentalSkills.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Fundamental Movement Assessment
                  </div>
                  <div className="space-y-2">
                    {fundamentalSkills.map((skill) => (
                      <SkillRow
                        key={skill.id}
                        label={skill.skillName}
                        value={selectedData.skillScores[skill.id]}
                        selfRating={selectedData.skillSelfRatings[skill.id]}
                        onChange={(v) =>
                          updateStudent(selected.id, (d) => ({ ...d, skillScores: { ...d.skillScores, [skill.id]: v } }))
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {specificSkills.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Specific Skill Assessment
                  </div>
                  <div className="space-y-2">
                    {specificSkills.map((skill) => (
                      <SkillRow
                        key={skill.id}
                        label={skill.skillName}
                        value={selectedData.skillScores[skill.id]}
                        selfRating={selectedData.skillSelfRatings[skill.id]}
                        onChange={(v) =>
                          updateStudent(selected.id, (d) => ({ ...d, skillScores: { ...d.skillScores, [skill.id]: v } }))
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              <SubmissionStatusBadge status={selectedData.submissionStatus[1]} />
              <BreakdownBar result={std1Result} />
              <FeedbackBox
                value={selectedData.feedback[1]}
                visible={selectedData.feedbackVisible[1]}
                onChange={(v) => updateStudent(selected.id, (d) => ({ ...d, feedback: { ...d.feedback, 1: v } }))}
                onVisibleChange={(v) =>
                  updateStudent(selected.id, (d) => ({ ...d, feedbackVisible: { ...d.feedbackVisible, 1: v } }))
                }
              />
            </section>

            {/* Standards 2 & 3 — per-question concept grading */}
            {([2, 3] as const).map((std) => (
              <section key={std} className="border-t border-gray-100 pt-6">
                <SectionHeader
                  title={STANDARD_NAMES[std]}
                  result={std === 2 ? std2Result : std3Result}
                  attemptCount={selectedData.attemptCount[std]}
                  hasSubmission={selectedData.submissionStatus[std] !== null}
                  onViewHistory={() => setHistoryStandard(std)}
                  onViewGradeHistory={() => setGradeHistoryStandard(std)}
                  gradeHistoryCount={selectedData.gradeHistory[std].length}
                />
                <div className="space-y-3">
                  {promptsByStandard[std].map((prompt) => (
                    <PromptRow
                      key={prompt.id}
                      promptText={prompt.promptText}
                      answer={selectedData.writtenResponses[prompt.id]}
                      score={selectedData.promptScores[prompt.id]}
                      selfRating={selectedData.promptSelfRatings[prompt.id]}
                      onChange={(v) =>
                        updateStudent(selected.id, (d) => ({ ...d, promptScores: { ...d.promptScores, [prompt.id]: v } }))
                      }
                    />
                  ))}
                  {promptsByStandard[std].length === 0 && (
                    <p className="text-sm text-gray-400 italic">No concept questions configured for this activity.</p>
                  )}
                </div>
                <SubmissionStatusBadge status={selectedData.submissionStatus[std]} />
                <BreakdownBar result={std === 2 ? std2Result : std3Result} />
                <FeedbackBox
                  value={selectedData.feedback[std]}
                  visible={selectedData.feedbackVisible[std]}
                  onChange={(v) => updateStudent(selected.id, (d) => ({ ...d, feedback: { ...d.feedback, [std]: v } }))}
                  onVisibleChange={(v) =>
                    updateStudent(selected.id, (d) => ({ ...d, feedbackVisible: { ...d.feedbackVisible, [std]: v } }))
                  }
                />
              </section>
            ))}

            {/* Standard 4 — demonstration (self + teacher rating) + concept questions */}
            <section className="border-t border-gray-100 pt-6">
              <SectionHeader
                title={STANDARD_NAMES[4]}
                result={std4Result}
                attemptCount={selectedData.attemptCount[4]}
                hasSubmission={selectedData.submissionStatus[4] !== null}
                onViewHistory={() => setHistoryStandard(4)}
                onViewGradeHistory={() => setGradeHistoryStandard(4)}
                gradeHistoryCount={selectedData.gradeHistory[4].length}
              />

              <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Demonstration of Teamwork &amp; Leadership
                </div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-48 text-sm text-gray-700">Student self-rating</div>
                  {selectedData.standard4StudentSelfRating !== null ? (
                    <div className={`px-2 py-0.5 rounded text-xs font-medium border ${COLOR_CLASSES[selectedData.standard4StudentSelfRating]}`}>
                      {selectedData.standard4StudentSelfRating} – {COLOR_LABELS[selectedData.standard4StudentSelfRating]}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">Not yet submitted</span>
                  )}
                </div>
                <SkillRow
                  label="Teacher rating"
                  value={selectedData.standard4TeacherRating ?? undefined}
                  selfRating={selectedData.standard4StudentSelfRating ?? undefined}
                  onChange={(v) => updateStudent(selected.id, (d) => ({ ...d, standard4TeacherRating: v }))}
                />
              </div>

              <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Understanding of Teamwork &amp; Leadership
              </div>
              <div className="space-y-3">
                {promptsByStandard[4].map((prompt) => (
                  <PromptRow
                    key={prompt.id}
                    promptText={prompt.promptText}
                    answer={selectedData.writtenResponses[prompt.id]}
                    score={selectedData.promptScores[prompt.id]}
                    onChange={(v) =>
                      updateStudent(selected.id, (d) => ({ ...d, promptScores: { ...d.promptScores, [prompt.id]: v } }))
                    }
                  />
                ))}
              </div>
              <SubmissionStatusBadge status={selectedData.submissionStatus[4]} />
              <BreakdownBar result={std4Result} />
              <FeedbackBox
                value={selectedData.feedback[4]}
                visible={selectedData.feedbackVisible[4]}
                onChange={(v) => updateStudent(selected.id, (d) => ({ ...d, feedback: { ...d.feedback, 4: v } }))}
                onVisibleChange={(v) =>
                  updateStudent(selected.id, (d) => ({ ...d, feedbackVisible: { ...d.feedbackVisible, 4: v } }))
                }
              />
            </section>

            {/* Approach to Learning */}
            <section className="border-t border-gray-100 pt-6">
              <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                Approach to Learning
                {atlResult && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-sm">
                    {atlResult.calculatedScore.toFixed(2)}
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-400 mb-3">Informational only — does not affect the overall letter grade.</p>

              <SkillRow
                label="Responsible & prepared"
                value={selectedData.atl.responsiblePrepared ?? undefined}
                onChange={(v) =>
                  updateStudent(selected.id, (d) => ({ ...d, atl: { ...d.atl, responsiblePrepared: v } }))
                }
              />
              <SkillRow
                label="Respectful & works well"
                value={selectedData.atl.respectfulWorks ?? undefined}
                onChange={(v) =>
                  updateStudent(selected.id, (d) => ({ ...d, atl: { ...d.atl, respectfulWorks: v } }))
                }
              />

              <div className="flex items-center gap-3 my-3">
                <div className="w-48 text-sm text-gray-700">Student effort self-rating</div>
                {selectedData.atl.effortStudentScore !== null ? (
                  <div className={`px-2 py-0.5 rounded text-xs font-medium border ${COLOR_CLASSES[selectedData.atl.effortStudentScore]}`}>
                    {selectedData.atl.effortStudentScore} – {COLOR_LABELS[selectedData.atl.effortStudentScore]}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400 italic">Not yet submitted</span>
                )}
              </div>

              <SkillRow
                label="Teacher effort rating"
                value={selectedData.atl.effortTeacherScore ?? undefined}
                onChange={(v) =>
                  updateStudent(selected.id, (d) => ({ ...d, atl: { ...d.atl, effortTeacherScore: v } }))
                }
              />

              <div className="flex items-center gap-4 mt-3">
                <div className="w-48 text-sm text-gray-700">Days late / unprepared</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateStudent(selected.id, (d) => ({
                        ...d,
                        atl: { ...d.atl, daysLateUnprepared: Math.max(0, d.atl.daysLateUnprepared - 1) },
                      }))
                    }
                    disabled={selectedData.atl.daysLateUnprepared === 0}
                    className="w-7 h-7 rounded border border-gray-200 text-gray-600 font-bold hover:bg-gray-100 disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-bold tabular-nums">{selectedData.atl.daysLateUnprepared}</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateStudent(selected.id, (d) => ({
                        ...d,
                        atl: { ...d.atl, daysLateUnprepared: d.atl.daysLateUnprepared + 1 },
                      }))
                    }
                    className="w-7 h-7 rounded border border-gray-200 text-gray-600 font-bold hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
                <span className="text-xs text-gray-500">
                  → Score {calculateDaysLateScore(selectedData.atl.daysLateUnprepared)}
                </span>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white rounded-xl border border-gray-200 flex items-center justify-center text-gray-400">
          Select a student to grade
        </div>
      )}

      {historyStandard && selectedData && (
        <HistoryModal
          standardNumber={historyStandard}
          attempts={selectedData.history[historyStandard]}
          current={buildCurrentAttempt(selectedData, historyStandard)}
          skillNameById={skillNameById}
          promptTextById={promptTextById}
          onClose={() => setHistoryStandard(null)}
        />
      )}
      {gradeHistoryStandard && selectedData && (
        <GradeHistoryModal
          standardNumber={gradeHistoryStandard}
          entries={selectedData.gradeHistory[gradeHistoryStandard]}
          onClose={() => setGradeHistoryStandard(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  result,
  attemptCount,
  hasSubmission,
  onViewHistory,
  onViewGradeHistory,
  gradeHistoryCount,
}: {
  title: string
  result: { score: number } | null
  attemptCount?: number
  hasSubmission?: boolean
  onViewHistory?: () => void
  onViewGradeHistory?: () => void
  gradeHistoryCount?: number
}) {
  return (
    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2 flex-wrap">
      {title}
      {result && (
        <span className={`px-2 py-0.5 rounded text-sm font-semibold ${SCORE_BADGE_COLOR[String(result.score)] ?? 'bg-gray-100 text-gray-700'}`}>
          {result.score}
        </span>
      )}
      <span className="ml-auto flex items-center gap-3">
        {onViewHistory && hasSubmission && (
          <button
            type="button"
            onClick={onViewHistory}
            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            Student resubmission history{attemptCount && attemptCount > 1 ? ` (${attemptCount} attempts)` : ''}
          </button>
        )}
        {onViewGradeHistory && (
          <button
            type="button"
            onClick={onViewGradeHistory}
            className="text-xs font-medium text-purple-600 hover:text-purple-800 hover:underline"
          >
            Teacher grading history{gradeHistoryCount ? ` (${gradeHistoryCount})` : ''}
          </button>
        )}
      </span>
    </h3>
  )
}

function GradeHistoryModal({
  standardNumber,
  entries,
  onClose,
}: {
  standardNumber: 1 | 2 | 3 | 4
  entries: GradeHistoryEntry[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-900">
            {STANDARD_NAMES[standardNumber]} — Teacher Grading History
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            &times;
          </button>
        </div>
        <div className="p-4 space-y-3">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No grading changes recorded yet.</p>
          ) : (
            entries.map((entry, i) => (
              <div key={entry.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-gray-800">
                    Change {i + 1}{i === entries.length - 1 ? ' (latest)' : ''}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(entry.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                  {entry.actorEmail && <span className="text-xs text-gray-400">by {entry.actorEmail}</span>}
                </div>
                <div className="text-sm text-gray-700 space-y-1">
                  <div>
                    Score: {entry.beforeValue?.score ?? '—'} → <strong>{entry.afterValue?.score ?? '—'}</strong>
                  </div>
                  {entry.beforeValue?.feedback !== entry.afterValue?.feedback && (
                    <div>
                      Feedback: <span className="text-gray-500">{entry.beforeValue?.feedback || '(none)'}</span> →{' '}
                      <span className="text-gray-900">{entry.afterValue?.feedback || '(none)'}</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function BreakdownBar({
  result,
}: {
  result: { breakdown: { red: number; yellow: number; lightGreen: number; brightGreen: number } } | null
}) {
  if (!result) return null
  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 flex gap-4 flex-wrap">
      <span>🔴 {result.breakdown.red} Red</span>
      <span>🟡 {result.breakdown.yellow} Yellow</span>
      <span>🟢 {result.breakdown.lightGreen} Light Green</span>
      <span>✅ {result.breakdown.brightGreen} Bright Green</span>
    </div>
  )
}

function SubmissionStatusBadge({ status }: { status: string | null }) {
  if (!status) {
    return <p className="mt-2 text-xs text-gray-400 italic">Student has not started this submission yet.</p>
  }
  return (
    <p className="mt-2 text-xs text-gray-500">
      Submission status: <span className="font-medium">{SUBMISSION_STATUS_LABEL[status] ?? status}</span>
    </p>
  )
}

function SelfRatingBadge({ rating }: { rating?: Score }) {
  if (rating === undefined) {
    return <span className="text-xs text-gray-400 italic">Student: not yet submitted</span>
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${COLOR_CLASSES[rating]}`}>
      Student: {rating} – {COLOR_LABELS[rating]}
    </span>
  )
}

function SkillRow({
  label,
  value,
  selfRating,
  onChange,
}: {
  label: string
  value: Score | undefined
  selfRating?: Score
  onChange: (v: Score) => void
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="w-48 text-sm text-gray-700 truncate" title={label}>{label}</div>
      <div className="flex gap-1">
        {([1, 2, 3, 4] as Score[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            title={`${v} – ${COLOR_LABELS[v]}`}
            aria-label={`${label}: ${COLOR_LABELS[v]}`}
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
      {value !== undefined ? (
        <div className={`px-2 py-0.5 rounded text-xs font-medium border ${COLOR_CLASSES[value]}`}>
          {COLOR_LABELS[value]}
        </div>
      ) : (
        <div className="px-2 py-0.5 rounded text-xs font-medium border bg-gray-50 text-gray-400 border-gray-200">
          Not yet graded
        </div>
      )}
      <SelfRatingBadge rating={selfRating} />
    </div>
  )
}

function PromptRow({
  promptText,
  answer,
  score,
  selfRating,
  onChange,
}: {
  promptText: string
  answer?: { text: string }
  score: Score | undefined
  selfRating?: Score
  onChange: (v: Score) => void
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="text-sm font-medium text-gray-800 mb-2">{promptText}</div>
      <div className="bg-gray-50 rounded-lg border border-gray-100 p-2.5 mb-2.5">
        {answer?.text ? (
          <p className="text-sm text-gray-700 leading-relaxed">{answer.text}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">No response submitted yet.</p>
        )}
      </div>
      <SkillRow label="Score" value={score} selfRating={selfRating} onChange={onChange} />
    </div>
  )
}

function HistoryModal({
  standardNumber,
  attempts,
  current,
  skillNameById,
  promptTextById,
  onClose,
}: {
  standardNumber: 1 | 2 | 3 | 4
  attempts: HistoryAttempt[]
  current: HistoryAttempt
  skillNameById: Record<string, string>
  promptTextById: Record<string, string>
  onClose: () => void
}) {
  const timeline = [...attempts, current]

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-semibold text-gray-900">
            {STANDARD_NAMES[standardNumber]} — Submission History
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            &times;
          </button>
        </div>
        <div className="p-4 space-y-4">
          {timeline.map((attempt, i) => (
            <div key={attempt.attemptNumber} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-gray-800">
                  Attempt {attempt.attemptNumber}
                  {i === timeline.length - 1 ? ' (current)' : ''}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(attempt.submittedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {attempt.writtenResponses.map((wr) => (
                <div key={wr.promptDefinitionId} className="mb-2">
                  <div className="text-xs font-medium text-gray-500 mb-0.5">
                    {promptTextById[wr.promptDefinitionId] ?? 'Question'}
                  </div>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded p-2">{wr.responseText}</p>
                </div>
              ))}
              {attempt.skillSelfRatings.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {attempt.skillSelfRatings.map((sr) => (
                    <span
                      key={sr.skillDefinitionId}
                      className={`px-2 py-0.5 rounded text-xs font-medium border ${COLOR_CLASSES[sr.rating as Score]}`}
                    >
                      {skillNameById[sr.skillDefinitionId] ?? 'Skill'}: {sr.rating}
                    </span>
                  ))}
                </div>
              )}
              {attempt.promptSelfRatings.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {attempt.promptSelfRatings.map((pr) => (
                    <span
                      key={pr.promptDefinitionId}
                      className={`px-2 py-0.5 rounded text-xs font-medium border ${COLOR_CLASSES[pr.rating as Score]}`}
                    >
                      Self-score: {pr.rating}
                    </span>
                  ))}
                </div>
              )}
              {attempt.standard4SelfRating !== null && (
                <div className="mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${COLOR_CLASSES[attempt.standard4SelfRating]}`}>
                    Teamwork/leadership self-rating: {attempt.standard4SelfRating}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FeedbackBox({
  value,
  visible,
  onChange,
  onVisibleChange,
}: {
  value: string
  visible: boolean
  onChange: (v: string) => void
  onVisibleChange: (v: boolean) => void
}) {
  return (
    <div className="mt-3">
      <label className="text-sm text-gray-600 block mb-1">Feedback:</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="Optional teacher feedback…"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
      />
      <label className="flex items-center gap-2 mt-1 text-xs text-gray-500 cursor-pointer">
        <input type="checkbox" checked={visible} onChange={(e) => onVisibleChange(e.target.checked)} className="rounded" />
        Visible to student
      </label>
    </div>
  )
}
