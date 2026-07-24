'use client'

import { useState } from 'react'
import { HonorCodeCheckbox } from './HonorCodeCheckbox'
import { StandardDistributionGrid, type ScoreBucket } from './ScoreDistributionChart'
import { cn } from '@/lib/utils'

const S4_RATING_LABELS: Record<number, { short: string; long: string; color: string }> = {
  4: { short: '4 — Outstanding', long: 'The class is better with me in it', color: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
  3: { short: '3 — Good',        long: 'I work well with others',           color: 'border-blue-400 bg-blue-50 text-blue-800' },
  2: { short: '2 — Developing',  long: 'I can improve on working with others', color: 'border-amber-400 bg-amber-50 text-amber-800' },
  1: { short: '1 — Beginning',   long: 'The class is worse with me in it',   color: 'border-red-400 bg-red-50 text-red-800' },
}

const SCORE_LABELS: Record<number, string> = { 1: 'Beginning', 2: 'Developing', 3: 'Proficient', 4: 'Advanced' }
const SCORE_COLORS: Record<number, string> = {
  1: 'border-red-400 bg-red-50 text-red-800',
  2: 'border-amber-400 bg-amber-50 text-amber-800',
  3: 'border-green-400 bg-green-50 text-green-800',
  4: 'border-emerald-400 bg-emerald-50 text-emerald-800',
}

interface Question {
  id: string
  promptText: string
  displayOrder: number
}

interface SkillDefinition {
  id: string
  skillName: string
  skillType: 'FUNDAMENTAL' | 'SPECIFIC'
  displayOrder: number
}

interface ExistingSubmission {
  standardNumber: number
  honorCodeAcknowledged?: boolean
  status?: string
  attemptNumber?: number
}

interface InitialSubmissionData {
  skillRatings: Record<string, number>
  responses: Record<number, Record<number, string>>
  promptRatings: Record<number, Record<number, number>>
  standard4SelfRating: number | null
}

interface CurrentClassScores {
  standard1: number | null
  standard2: number | null
  standard3: number | null
  standard4: number | null
  letterGrade: string | null
}

interface SubmissionFormProps {
  instanceId: string
  activityName: string
  skillDefinitions: SkillDefinition[]
  standard2Questions: Question[]
  standard3Questions: Question[]
  standard4Questions: Question[]
  existingSubmissions?: ExistingSubmission[]
  initialData?: InitialSubmissionData
  currentClassScores?: CurrentClassScores
  scoreDistribution?: Record<1 | 2 | 3 | 4, ScoreBucket[]>
}

const FINALIZED_STATUSES = new Set(['SUBMITTED', 'REASSESSMENT_SUBMITTED'])

type ActiveStd = 1 | 2 | 3 | 4

function ScoreSelector({
  value,
  onChange,
  name,
}: {
  value: number
  onChange: (v: number) => void
  name: string
}) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label={name}>
      {([1, 2, 3, 4] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          title={SCORE_LABELS[v]}
          onClick={() => onChange(v)}
          className={cn(
            'w-9 h-9 rounded-lg border-2 text-xs font-bold transition-colors',
            value === v ? SCORE_COLORS[v] : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300',
          )}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

function SkillSelfRatingRow({
  name,
  value,
  onChange,
}: {
  name: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-slate-700">{name}</span>
      <ScoreSelector value={value} onChange={onChange} name={name} />
    </div>
  )
}

function SelfRating({
  label,
  name,
  value,
  onChange,
}: {
  label: string
  name: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700 mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([4, 3, 2, 1] as const).map((v) => {
          const cfg = S4_RATING_LABELS[v]
          const selected = value === v
          return (
            <label
              key={v}
              className={cn(
                'flex flex-col gap-1 p-3 rounded-xl border-2 cursor-pointer transition-colors',
                selected ? cfg.color : 'border-slate-200 bg-white hover:border-slate-300',
              )}
            >
              <input
                type="radio"
                name={name}
                value={v}
                checked={selected}
                onChange={() => onChange(v)}
                className="sr-only"
              />
              <span className="font-bold text-sm">{cfg.short}</span>
              <span className={cn('text-xs leading-snug', selected ? '' : 'text-slate-500')}>
                {cfg.long}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

export function SubmissionForm({
  instanceId,
  activityName,
  skillDefinitions,
  standard2Questions,
  standard3Questions,
  standard4Questions,
  existingSubmissions = [],
  initialData,
  currentClassScores,
  scoreDistribution = { 1: [], 2: [], 3: [], 4: [] },
}: SubmissionFormProps) {
  const finalizedStandards = new Set(
    existingSubmissions.filter((s) => FINALIZED_STATUSES.has(s.status ?? '')).map((s) => s.standardNumber),
  )
  const anyFinalized = finalizedStandards.size > 0
  const allVisitedStandardsFinalized =
    existingSubmissions.length > 0 && existingSubmissions.every((s) => FINALIZED_STATUSES.has(s.status ?? ''))

  const [activeStd, setActiveStd] = useState<ActiveStd>(1)
  const [skillRatings, setSkillRatings] = useState<Record<string, number>>(initialData?.skillRatings ?? {})
  const [responses, setResponses] = useState<Record<number, Record<number, string>>>(
    initialData?.responses ?? { 2: {}, 3: {}, 4: {} },
  )
  const [promptRatings, setPromptRatings] = useState<Record<number, Record<number, number>>>(
    initialData?.promptRatings ?? { 2: {}, 3: {} },
  )
  const [selfRating, setSelfRating] = useState(initialData?.standard4SelfRating ?? 3)
  const [honorCode, setHonorCode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setResponse(std: number, order: number, val: string) {
    setResponses((prev) => ({
      ...prev,
      [std]: { ...prev[std], [order]: val },
    }))
  }

  function setPromptRating(std: number, order: number, val: number) {
    setPromptRatings((prev) => ({
      ...prev,
      [std]: { ...prev[std], [order]: val },
    }))
  }

  async function handleSubmit(isDraft: boolean) {
    if (!isDraft && !honorCode) {
      setError('You must acknowledge the Honor Code before submitting.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const questionSetsForSubmit: Record<2 | 3 | 4, Question[]> = {
        2: standard2Questions,
        3: standard3Questions,
        4: standard4Questions,
      }

      // Each standard resubmits independently — a rejection on one
      // (e.g. no meaningful change) shouldn't block the others from saving.
      const rejections: string[] = []
      let anySucceeded = false

      for (const stdNum of [1, 2, 3, 4] as const) {
        if (stdNum === 1 && skillDefinitions.length === 0) continue

        // Drafting only applies to standards not yet finalized — a
        // finalized standard can only be changed via a full resubmission.
        if (isDraft && finalizedStandards.has(stdNum)) continue

        const body: {
          skillSelfRatings?: { skillDefinitionId: string; rating: number }[]
          writtenResponses?: { promptDefinitionId: string; responseText: string }[]
          promptSelfRatings?: { promptDefinitionId: string; rating: number }[]
          submit: boolean
          standard4SelfRating?: number
        } = { submit: !isDraft }

        if (stdNum === 1) {
          body.skillSelfRatings = skillDefinitions.map((s) => ({
            skillDefinitionId: s.id,
            rating: skillRatings[s.id] ?? 3,
          }))
        } else {
          // Only send questions the student has actually answered — other
          // tabs may not have been visited yet, and the API rejects blank
          // written responses.
          const answeredQuestions = questionSetsForSubmit[stdNum].filter(
            (q) => (responses[stdNum]?.[q.displayOrder] ?? '').trim().length > 0,
          )
          if (answeredQuestions.length > 0) {
            body.writtenResponses = answeredQuestions.map((q) => ({
              promptDefinitionId: q.id,
              responseText: responses[stdNum][q.displayOrder],
            }))
            if (stdNum === 2 || stdNum === 3) {
              body.promptSelfRatings = answeredQuestions.map((q) => ({
                promptDefinitionId: q.id,
                rating: promptRatings[stdNum]?.[q.displayOrder] ?? 3,
              }))
            }
          }
          if (stdNum === 4) body.standard4SelfRating = selfRating
        }

        // Nothing to save for this standard yet (student hasn't visited this
        // tab) — skip it rather than creating an empty submission shell.
        if (stdNum !== 1 && stdNum !== 4 && !body.writtenResponses) {
          continue
        }

        try {
          // Ensure the submission shell exists and the Honor Code is on record
          const createRes = await fetch('/api/student/submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instanceId,
              standardNumber: stdNum,
              honorCodeAcknowledged: true,
            }),
          })
          if (!createRes.ok) {
            const data = await createRes.json().catch(() => ({}))
            throw new Error(data.error ?? `Failed to save Standard ${stdNum}`)
          }

          const res = await fetch(
            `/api/student/submissions/${instanceId}/${stdNum}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            },
          )
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error ?? `Failed to save Standard ${stdNum}`)
          }
          anySucceeded = true
        } catch (e) {
          // Only surface per-standard rejections for a real resubmission
          // attempt — for a first-time submission, any failure is fatal.
          if (isDraft || finalizedStandards.has(stdNum)) {
            rejections.push(`Standard ${stdNum}: ${e instanceof Error ? e.message : 'Failed to save.'}`)
          } else {
            throw e
          }
        }
      }

      if (rejections.length > 0) {
        setError(rejections.join(' '))
      }
      if (!isDraft && anySucceeded) setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    const standardScores = currentClassScores
      ? [
          { label: 'Standard 1', score: currentClassScores.standard1 },
          { label: 'Standard 2', score: currentClassScores.standard2 },
          { label: 'Standard 3', score: currentClassScores.standard3 },
          { label: 'Standard 4', score: currentClassScores.standard4 },
        ]
      : []

    return (
      <div className="space-y-5">
        <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 p-8 text-center">
          <div className="text-4xl mb-3" aria-hidden="true">✓</div>
          <h2 className="text-lg font-bold text-emerald-800 mb-2">
            {anyFinalized ? 'Resubmitted!' : 'Work Submitted!'}
          </h2>
          <p className="text-sm text-emerald-700">
            Your work for {activityName} has been submitted. Your teacher will review it soon.
          </p>
        </div>

        {currentClassScores && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Your Scores — {activityName}</h3>
              {currentClassScores.letterGrade && (
                <span className="text-2xl font-bold text-slate-900">{currentClassScores.letterGrade}</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {standardScores.map(({ label, score }) => (
                <div key={label} className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-400 mb-1">{label}</div>
                  <div className="text-xl font-bold text-slate-800">{score ?? '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="font-semibold text-slate-900 mb-1">All Your Classes</h3>
          <p className="text-xs text-slate-400 mb-4">
            Every score your teachers have given you, by standard, pooled across every class this
            year. Hover a slice to see the breakdown by class.
          </p>
          <StandardDistributionGrid distribution={scoreDistribution} />
        </div>

        <button
          onClick={() => setSaved(false)}
          className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors"
        >
          Resubmit
        </button>
      </div>
    )
  }

  const TAB_LABELS: Record<ActiveStd, string> = {
    1: 'Movement Skills',
    2: 'Movement Concepts',
    3: 'Health & Fitness',
    4: 'Teamwork',
  }

  const questionSets: Record<2 | 3 | 4, Question[]> = {
    2: standard2Questions,
    3: standard3Questions,
    4: standard4Questions,
  }

  const fundamentalSkills = skillDefinitions.filter((s) => s.skillType === 'FUNDAMENTAL')
  const specificSkills = skillDefinitions.filter((s) => s.skillType === 'SPECIFIC')

  return (
    <div className="space-y-5">
      {allVisitedStandardsFinalized && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
          You've already submitted this work. You can revise your answers and resubmit — just
          change at least one score or edit a comment for each standard you want to resubmit.
        </div>
      )}

      {/* Standard tabs */}
      <div
        className="flex bg-slate-100 rounded-xl p-1 gap-1"
        role="tablist"
        aria-label="Standards"
      >
        {([1, 2, 3, 4] as const).map((n) => (
          <button
            key={n}
            role="tab"
            aria-selected={activeStd === n}
            onClick={() => setActiveStd(n)}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors',
              activeStd === n
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            <span className="hidden sm:inline">Standard {n}: </span>
            {TAB_LABELS[n]}
          </button>
        ))}
      </div>

      {/* Question section */}
      <div role="tabpanel" className="space-y-4">
        {activeStd === 1 && (
          <div className="space-y-5">
            <p className="text-xs text-slate-500">
              Rate your own performance on each skill. Your teacher will also score these — their
              score is what counts toward your grade.
            </p>
            {skillDefinitions.length === 0 ? (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-6 text-center text-sm text-slate-400">
                No skills configured for this activity.
              </div>
            ) : (
              <>
                {fundamentalSkills.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Fundamental Movement Assessment
                    </div>
                    <div className="divide-y divide-slate-100">
                      {fundamentalSkills.map((s) => (
                        <SkillSelfRatingRow
                          key={s.id}
                          name={s.skillName}
                          value={skillRatings[s.id] ?? 3}
                          onChange={(v) => setSkillRatings((prev) => ({ ...prev, [s.id]: v }))}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {specificSkills.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Specific Skill Assessment
                    </div>
                    <div className="divide-y divide-slate-100">
                      {specificSkills.map((s) => (
                        <SkillSelfRatingRow
                          key={s.id}
                          name={s.skillName}
                          value={skillRatings[s.id] ?? 3}
                          onChange={(v) => setSkillRatings((prev) => ({ ...prev, [s.id]: v }))}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeStd === 4 && (
          <div className="space-y-4">
            <SelfRating
              label="How would you rate your teamwork and leadership this rotation?"
              name="self-rating"
              value={selfRating}
              onChange={setSelfRating}
            />
          </div>
        )}

        {(activeStd === 2 || activeStd === 3 || activeStd === 4) && (
          questionSets[activeStd].length === 0 ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-6 text-center text-sm text-slate-400">
              No written questions for this activity.
            </div>
          ) : (
            questionSets[activeStd].map((q) => (
              <div key={q.id}>
                <label className="block text-sm font-semibold text-slate-700 mb-2 leading-snug">
                  {q.displayOrder}. {q.promptText}
                </label>
                <textarea
                  value={responses[activeStd]?.[q.displayOrder] ?? ''}
                  onChange={(e) => setResponse(activeStd, q.displayOrder, e.target.value)}
                  rows={4}
                  placeholder="Write your response here…"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
                {(activeStd === 2 || activeStd === 3) && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs font-medium text-slate-500">Rate your own answer:</span>
                    <ScoreSelector
                      value={promptRatings[activeStd]?.[q.displayOrder] ?? 3}
                      onChange={(v) => setPromptRating(activeStd, q.displayOrder, v)}
                      name={`self-rating-${activeStd}-${q.displayOrder}`}
                    />
                  </div>
                )}
              </div>
            ))
          )
        )}
      </div>

      {/* Honor Code */}
      <HonorCodeCheckbox checked={honorCode} onChange={setHonorCode} />

      {error && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-200">
          {error}
        </p>
      )}

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {!allVisitedStandardsFinalized && (
          <button
            onClick={() => handleSubmit(true)}
            disabled={saving}
            className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold text-sm hover:border-slate-300 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
        )}
        <button
          onClick={() => handleSubmit(false)}
          disabled={!honorCode || saving}
          className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Submitting…' : anyFinalized ? 'Resubmit Work' : 'Submit Work'}
        </button>
      </div>

      {!honorCode && (
        <p className="text-xs text-slate-400 text-center">
          Check the Honor Code above to enable submission.
        </p>
      )}
    </div>
  )
}
