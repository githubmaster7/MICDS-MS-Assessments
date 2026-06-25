'use client'

import { useState } from 'react'
import { ACTIVITY_SKILLS } from '@/lib/skills/definitions'
import { calculateStandard1 } from '@/lib/grading/standard1'
import { calculateOverallGrade } from '@/lib/grading/conversion'
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

const TABS = ['Standard 1', 'Standard 2', 'Standard 3', 'Standard 4', 'ATL'] as const
type Tab = typeof TABS[number]

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

export function IndividualGradeView({
  student,
  activityName,
  instanceId,
  initialSkillScores = {},
}: {
  student: Student
  activityName: string
  instanceId: string
  initialSkillScores?: Record<string, ColorScore>
}) {
  const [activeTab, setActiveTab] = useState<Tab>('Standard 1')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [unsaved, setUnsaved] = useState(false)

  const [skillScores, setSkillScores] = useState<Record<string, ColorScore>>(initialSkillScores)
  const [std2Score, setStd2Score] = useState<ValidScore>((student.standard2Score as ValidScore) ?? 3)
  const [std3Score, setStd3Score] = useState<ValidScore>((student.standard3Score as ValidScore) ?? 3)
  const [std4Score, setStd4Score] = useState<ValidScore>((student.standard4Score as ValidScore) ?? 3)
  const [std4TeacherRating, setStd4TeacherRating] = useState<ColorScore>((student.standard4Score as ColorScore) ?? 3)
  const [feedback, setFeedback] = useState<Record<number, string>>({})
  const [feedbackVisible, setFeedbackVisible] = useState<Record<number, boolean>>({})
  const [daysLate, setDaysLate] = useState(student.daysLateUnprepared ?? 0)
  const [effortTeacher, setEffortTeacher] = useState<ColorScore>((student.effortTeacherScore as ColorScore) ?? 3)
  const [responsiblePrep, setResponsiblePrep] = useState<ColorScore>((student.responsiblePrepared as ColorScore) ?? 3)
  const [respectfulWork, setRespectfulWork] = useState<ColorScore>((student.respectfulWorks as ColorScore) ?? 3)

  function markUnsaved() { setUnsaved(true); setSaved(false) }

  const activity = ACTIVITY_SKILLS[activityName]

  function calcStd1() {
    if (!activity) return null
    const skills = [
      ...activity.fundamental.map((s) => ({ skillId: s.name, score: skillScores[s.name] ?? 2 as ColorScore })),
      ...activity.specific.map((s) => ({ skillId: s.name, score: skillScores[s.name] ?? 2 as ColorScore })),
    ]
    if (skills.length === 0) return null
    try { return calculateStandard1(skills) } catch { return null }
  }

  const std1Result = calcStd1()
  const overall = (() => {
    const s1 = std1Result?.score
    if (!s1) return null
    try { return calculateOverallGrade({ s1, s2: std2Score, s3: std3Score, s4: std4Score }) } catch { return null }
  })()

  async function handleSave() {
    setSaving(true)
    try {
      const body = {
        studentId: student.id,
        instanceId,
        skillScores,
        standard1Score: std1Result?.score ?? null,
        standard2Score: std2Score,
        standard3Score: std3Score,
        standard4Score: std4Score,
        standard4TeacherRating: std4TeacherRating,
        daysLateUnprepared: daysLate,
        effortTeacherScore: effortTeacher,
        responsiblePrepared: responsiblePrep,
        respectfulWorks: respectfulWork,
        feedback,
        feedbackVisible,
      }
      const res = await fetch(`/api/teacher/grades/${student.id}/${instanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      setSaved(true)
      setUnsaved(false)
    } catch (e) {
      alert(`Save failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Tabs */}
      <div className="bg-white rounded-t-xl border border-slate-200 border-b-0 px-4 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          let score: number | null = null
          if (tab === 'Standard 1') score = std1Result?.score ?? null
          if (tab === 'Standard 2') score = std2Score
          if (tab === 'Standard 3') score = std3Score
          if (tab === 'Standard 4') score = std4Score
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors focus-visible:outline-none ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab}
              {score != null && tab !== 'ATL' && (
                <span className={`ml-1.5 text-xs tabular-nums ${SCORE_LABEL_COLORS[score] ?? 'text-slate-400'}`}>
                  {score}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="bg-white rounded-b-xl border border-slate-200 p-6">
        {activeTab === 'Standard 1' && (
          <Standard1Grader
            activity={activity}
            skillScores={skillScores}
            onSkillChange={(name, score) => {
              setSkillScores((prev) => ({ ...prev, [name]: score }))
              markUnsaved()
            }}
          />
        )}

        {activeTab === 'Standard 2' && (
          <Standard234Grader
            standardNumber={2}
            teacherScore={std2Score}
            onScoreChange={(v) => { setStd2Score(v); markUnsaved() }}
            feedbackText={feedback[2] ?? ''}
            onFeedbackChange={(v) => { setFeedback((p) => ({ ...p, [2]: v })); markUnsaved() }}
            isFeedbackVisible={feedbackVisible[2] ?? false}
            onVisibleChange={(v) => { setFeedbackVisible((p) => ({ ...p, [2]: v })); markUnsaved() }}
          />
        )}

        {activeTab === 'Standard 3' && (
          <Standard234Grader
            standardNumber={3}
            teacherScore={std3Score}
            onScoreChange={(v) => { setStd3Score(v); markUnsaved() }}
            feedbackText={feedback[3] ?? ''}
            onFeedbackChange={(v) => { setFeedback((p) => ({ ...p, [3]: v })); markUnsaved() }}
            isFeedbackVisible={feedbackVisible[3] ?? false}
            onVisibleChange={(v) => { setFeedbackVisible((p) => ({ ...p, [3]: v })); markUnsaved() }}
          />
        )}

        {activeTab === 'Standard 4' && (
          <div className="space-y-6">
            <Standard4SelfRating
              studentRating={(student.standard4SelfRating as ColorScore) ?? 3}
              teacherRating={std4TeacherRating}
              onTeacherRatingChange={(v) => { setStd4TeacherRating(v); markUnsaved() }}
            />
            <Standard234Grader
              standardNumber={4}
              teacherScore={std4Score}
              onScoreChange={(v) => { setStd4Score(v); markUnsaved() }}
              feedbackText={feedback[4] ?? ''}
              onFeedbackChange={(v) => { setFeedback((p) => ({ ...p, [4]: v })); markUnsaved() }}
              isFeedbackVisible={feedbackVisible[4] ?? false}
              onVisibleChange={(v) => { setFeedbackVisible((p) => ({ ...p, [4]: v })); markUnsaved() }}
            />
          </div>
        )}

        {activeTab === 'ATL' && (
          <ATLGrader
            daysLate={daysLate}
            onDaysLateChange={(v) => { setDaysLate(v); markUnsaved() }}
            effortStudentScore={3}
            effortTeacherScore={effortTeacher}
            onEffortTeacherChange={(v) => { setEffortTeacher(v); markUnsaved() }}
            responsiblePrepared={responsiblePrep}
            onResponsiblePreparedChange={(v) => { setResponsiblePrep(v); markUnsaved() }}
            respectfulWorks={respectfulWork}
            onRespectfulWorksChange={(v) => { setRespectfulWork(v); markUnsaved() }}
          />
        )}
      </div>

      {/* Footer grade bar */}
      <div className="mt-4 bg-white rounded-xl border border-slate-200 px-5 py-3 flex items-center gap-4">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">Grade</span>
        <div className="flex gap-4 flex-1">
          {[
            { label: 'S1', score: std1Result?.score },
            { label: 'S2', score: std2Score },
            { label: 'S3', score: std3Score },
            { label: 'S4', score: std4Score },
          ].map(({ label, score }) => (
            <div key={label} className="flex items-center gap-1">
              <span className="text-xs text-slate-400">{label}</span>
              <span className={`text-sm font-bold tabular-nums ${score != null ? SCORE_LABEL_COLORS[score] : 'text-slate-300'}`}>
                {score ?? '—'}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {unsaved && <span className="text-xs text-amber-600">Unsaved changes</span>}
          {saved && <span className="text-xs text-emerald-600">Saved</span>}
          {overall && (
            <div className={`text-xl font-bold px-3 py-1 rounded-lg border-2 ${GRADE_COLORS[overall.letterGrade] ?? 'text-slate-700'}`}>
              {overall.letterGrade}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save All'}
          </button>
        </div>
      </div>
    </div>
  )
}
