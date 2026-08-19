'use client'

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { HonorCodeCheckbox } from './HonorCodeCheckbox'
import { StandardDistributionGrid, type ScoreBucket } from './ScoreDistributionChart'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SCORING_RUBRIC } from '@/lib/grading/rubric'
import { ScoringRubricCard } from '@/components/shared/ScoringRubricCard'
import { isRevised } from '@/lib/grading/resubmission'

const S4_RATING_LABELS: Record<number, { short: string; long: string; color: string }> = {
  4: { short: '4 - Exceeding', long: 'The class is better with me in it', color: 'border-score-exceeding-border bg-score-exceeding-bg text-score-exceeding-text' },
  3: { short: '3 - Achieving', long: 'I work well with others',           color: 'border-score-achieving-border bg-score-achieving-bg text-score-achieving-text' },
  2: { short: '2 - Developing',  long: 'I can improve on working with others', color: 'border-score-developing-border bg-score-developing-bg text-score-developing-text' },
  1: { short: '1 - Incomplete',   long: 'The class is worse with me in it',   color: 'border-score-incomplete-border bg-score-incomplete-bg text-score-incomplete-text' },
}

const EFFORT_RATING_LABELS: Record<number, { short: string; long: string; color: string }> = {
  4: { short: '4 - Exceeding', long: 'I consistently give my best effort in every class', color: 'border-score-exceeding-border bg-score-exceeding-bg text-score-exceeding-text' },
  3: { short: '3 - Achieving', long: 'I give good effort in most classes', color: 'border-score-achieving-border bg-score-achieving-bg text-score-achieving-text' },
  2: { short: '2 - Developing', long: "I sometimes hold back or don't try my best", color: 'border-score-developing-border bg-score-developing-bg text-score-developing-text' },
  1: { short: '1 - Incomplete', long: 'I rarely put in effort during class', color: 'border-score-incomplete-border bg-score-incomplete-bg text-score-incomplete-text' },
}

const SCORE_LABELS: Record<number, string> = { 1: 'Incomplete', 2: 'Developing', 3: 'Achieving', 4: 'Exceeding' }
const SCORE_COLORS: Record<number, string> = {
  1: 'border-score-incomplete-border bg-score-incomplete-bg text-score-incomplete-text',
  2: 'border-score-developing-border bg-score-developing-bg text-score-developing-text',
  3: 'border-score-achieving-border bg-score-achieving-bg text-score-achieving-text',
  4: 'border-score-exceeding-border bg-score-exceeding-bg text-score-exceeding-text',
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
  reassessmentResponses: Record<number, Record<number, string>>
  promptRatings: Record<number, Record<number, number>>
  standard4SelfRating: number | null
  effortSelfRating: number | null
}

interface CurrentClassScores {
  standard1: number | null
  standard2: number | null
  standard3: number | null
  standard4: number | null
  letterGrade: string | null
}

// The teacher's own scores/feedback, shown alongside the student's self-
// grading UI - the mirror of the SelfRatingBadge a teacher sees while
// grading. Feedback is only ever populated when the teacher marked it
// visible to the student; the numeric scores are never gated.
interface TeacherGradeData {
  skillScores: Record<string, number>
  promptScores: Record<string, number>
  standard4Rating: number | null
  feedback: Record<1 | 2 | 3 | 4, string | null>
  atl: {
    responsiblePrepared: number | null
    respectfulWorks: number | null
    effortTeacherScore: number | null
    calculatedScore: number | null
  }
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
  teacherGrades?: TeacherGradeData
  scoreDistribution?: Record<1 | 2 | 3 | 4, ScoreBucket[]>
}

const FINALIZED_STATUSES = new Set(['SUBMITTED', 'REASSESSMENT_SUBMITTED'])

type ActiveStd = 1 | 2 | 3 | 4 | 'atl'

function ScoreSelector({
  value,
  onChange,
  name,
}: {
  value: number | null
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
            value === v ? SCORE_COLORS[v] : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300',
          )}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

// Mirrors the teacher's own SelfRatingBadge (GradingInterface.tsx), just in
// the other direction - the teacher's score shown to the student.
function TeacherScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) {
    return <span className="text-xs text-gray-400 italic">Teacher: not yet graded</span>
  }
  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-medium border', SCORE_COLORS[score])}>
      Teacher: {score} – {SCORE_LABELS[score]}
    </span>
  )
}

function SkillSelfRatingRow({
  name,
  value,
  onChange,
  teacherScore,
}: {
  name: string
  value: number | null
  onChange: (v: number) => void
  teacherScore?: number | null
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 flex-wrap">
      <span className="text-sm text-gray-700">{name}</span>
      <div className="flex items-center gap-3">
        <ScoreSelector value={value} onChange={onChange} name={name} />
        <TeacherScoreBadge score={teacherScore} />
      </div>
    </div>
  )
}

function SelfRating({
  label,
  name,
  value,
  onChange,
  labels,
}: {
  label: string
  name: string
  value: number | null
  onChange: (v: number) => void
  labels: Record<number, { short: string; long: string; color: string }>
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([4, 3, 2, 1] as const).map((v) => {
          const cfg = labels[v]
          const selected = value === v
          return (
            <label
              key={v}
              className={cn(
                'flex flex-col gap-1 p-3 rounded-xl border-2 cursor-pointer transition-colors',
                selected ? cfg.color : 'border-gray-200 bg-white hover:border-gray-300',
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
              <span className={cn('text-xs leading-snug', selected ? '' : 'text-gray-500')}>
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
  teacherGrades,
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
  const [reassessmentResponses, setReassessmentResponses] = useState<Record<number, Record<number, string>>>(
    initialData?.reassessmentResponses ?? { 2: {}, 3: {}, 4: {} },
  )
  const [promptRatings, setPromptRatings] = useState<Record<number, Record<number, number>>>(
    initialData?.promptRatings ?? { 2: {}, 3: {} },
  )
  const [selfRating, setSelfRating] = useState<number | null>(initialData?.standard4SelfRating ?? null)
  const [effortSelfRating, setEffortSelfRating] = useState<number | null>(initialData?.effortSelfRating ?? null)
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

  function setReassessmentResponse(std: number, order: number, val: string) {
    setReassessmentResponses((prev) => ({
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

  // Whether this standard's own fields differ from the last saved attempt
  // (initialData) - used to decide, for a resubmission, which standards
  // actually have something new to send. Eligibility itself is judged once
  // across the whole submission in handleSubmit, not per standard.
  function standardHasChange(stdNum: 1 | 2 | 3 | 4): boolean {
    if (stdNum === 1) {
      return skillDefinitions.some(
        (s) => (skillRatings[s.id] ?? null) !== (initialData?.skillRatings[s.id] ?? null),
      )
    }
    const questions = stdNum === 2 ? standard2Questions : stdNum === 3 ? standard3Questions : standard4Questions
    const textChanged = questions.some((q) => {
      const before = initialData?.responses[stdNum]?.[q.displayOrder] ?? ''
      const after = responses[stdNum]?.[q.displayOrder] ?? ''
      return isRevised(before, after)
    })
    if (textChanged) return true
    if (stdNum === 2 || stdNum === 3) {
      return questions.some(
        (q) => (promptRatings[stdNum]?.[q.displayOrder] ?? null) !== (initialData?.promptRatings[stdNum]?.[q.displayOrder] ?? null),
      )
    }
    return (selfRating ?? null) !== (initialData?.standard4SelfRating ?? null)
  }

  // One standard's full save (create shell + PUT). Returns a result object
  // instead of throwing so the caller can run all four standards
  // concurrently via Promise.all and only decide what's fatal once every
  // request has settled — previously these ran one after another, so a
  // student answering all four standards + ATL waited on up to 9 sequential
  // round trips before the button ever unfroze.
  async function submitStandard(
    stdNum: 1 | 2 | 3 | 4,
    isDraft: boolean,
  ): Promise<{ stdNum: number; skipped: boolean; ok: boolean; fatal: boolean; message?: string }> {
    if (stdNum === 1 && skillDefinitions.length === 0) {
      return { stdNum, skipped: true, ok: true, fatal: false }
    }

    const questionSetsForSubmit: Record<2 | 3 | 4, Question[]> = {
      2: standard2Questions,
      3: standard3Questions,
      4: standard4Questions,
    }

    // The reassessment box is independent of the draft/finalized/resubmit
    // flow entirely - it's always saveable, so its presence overrides every
    // skip condition below that would otherwise leave this standard untouched.
    const reassessmentItems =
      stdNum === 2 || stdNum === 3 || stdNum === 4
        ? questionSetsForSubmit[stdNum]
            .map((q) => ({ promptDefinitionId: q.id, text: (reassessmentResponses[stdNum]?.[q.displayOrder] ?? '').trim() }))
            .filter((item) => item.text.length > 0)
        : []
    const hasReassessmentContent = reassessmentItems.length > 0

    // Drafting only applies to standards not yet finalized — a finalized
    // standard can only be changed via a full resubmission.
    if (isDraft && finalizedStandards.has(stdNum) && !hasReassessmentContent) {
      return { stdNum, skipped: true, ok: true, fatal: false }
    }
    // Resubmission is judged across the whole submission, not standard by
    // standard (checked once in handleSubmit before any request is sent) — a
    // finalized standard with no change of its own is left untouched rather
    // than resent and rejected individually for "nothing changed here."
    if (!isDraft && finalizedStandards.has(stdNum) && !standardHasChange(stdNum) && !hasReassessmentContent) {
      return { stdNum, skipped: true, ok: true, fatal: false }
    }

    const body: {
      skillSelfRatings?: { skillDefinitionId: string; rating: number }[]
      writtenResponses?: { promptDefinitionId: string; responseText: string }[]
      promptSelfRatings?: { promptDefinitionId: string; rating: number }[]
      reassessmentResponses?: { promptDefinitionId: string; reassessmentResponseText: string }[]
      submit: boolean
      standard4SelfRating?: number
    } = { submit: !isDraft }

    if (stdNum === 1) {
      // Only send skills the student actually rated - an untouched skill has
      // no opinion recorded, and must never be reported as a real score of 3.
      body.skillSelfRatings = skillDefinitions
        .filter((s) => skillRatings[s.id] != null)
        .map((s) => ({ skillDefinitionId: s.id, rating: skillRatings[s.id] }))
    } else {
      // Only send questions the student has actually answered — other tabs
      // may not have been visited yet, and the API rejects blank written
      // responses.
      const answeredQuestions = questionSetsForSubmit[stdNum].filter(
        (q) => (responses[stdNum]?.[q.displayOrder] ?? '').trim().length > 0,
      )
      if (answeredQuestions.length > 0) {
        body.writtenResponses = answeredQuestions.map((q) => ({
          promptDefinitionId: q.id,
          responseText: responses[stdNum][q.displayOrder],
        }))
        if (stdNum === 2 || stdNum === 3) {
          body.promptSelfRatings = answeredQuestions
            .filter((q) => promptRatings[stdNum]?.[q.displayOrder] != null)
            .map((q) => ({ promptDefinitionId: q.id, rating: promptRatings[stdNum][q.displayOrder] }))
        }
      }
      if (stdNum === 4 && selfRating != null) body.standard4SelfRating = selfRating
      if (hasReassessmentContent) {
        body.reassessmentResponses = reassessmentItems.map((item) => ({
          promptDefinitionId: item.promptDefinitionId,
          reassessmentResponseText: item.text,
        }))
      }
    }

    // Nothing to save for this standard yet (student hasn't visited this
    // tab) — skip it rather than creating an empty submission shell.
    if (stdNum !== 1 && stdNum !== 4 && !body.writtenResponses && !hasReassessmentContent) {
      return { stdNum, skipped: true, ok: true, fatal: false }
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

      const res = await fetch(`/api/student/submissions/${instanceId}/${stdNum}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Failed to save Standard ${stdNum}`)
      }
      return { stdNum, skipped: false, ok: true, fatal: false }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save.'
      // Only surface per-standard rejections for a real resubmission
      // attempt — for a first-time submission, any failure is fatal.
      const fatal = !(isDraft || finalizedStandards.has(stdNum))
      return { stdNum, skipped: false, ok: false, fatal, message }
    }
  }

  async function handleSubmit(isDraft: boolean) {
    if (!isDraft && !honorCode) {
      setError('You must acknowledge the Honor Code before submitting.')
      return
    }
    // Flips the button to its disabled "Saving…"/"Submitting…" label the
    // instant the student taps it — before any network request is even
    // constructed — so the UI never reads as frozen while the requests below
    // run in the background.
    setError(null)
    setSaving(true)
    try {
      // Each standard resubmits independently and concurrently — a rejection
      // on one (e.g. no meaningful change) shouldn't block the others from
      // saving, and none of them need to wait on the others to start.
      const results = await Promise.all(
        ([1, 2, 3, 4] as const).map((stdNum) => submitStandard(stdNum, isDraft)),
      )

      const rejections = results
        .filter((r) => !r.skipped && !r.ok)
        .map((r) => `Standard ${r.stdNum}: ${r.message}`)
      const anySucceeded = results.some((r) => !r.skipped && r.ok)
      const fatalFailure = results.find((r) => !r.ok && r.fatal)

      // A fatal failure (a first-time, non-draft submission that a standard
      // rejected outright) mirrors the old behavior: stop here, skip the ATL
      // save, and surface the error rather than a false success.
      if (fatalFailure) {
        setError(fatalFailure.message ?? 'Something went wrong. Please try again.')
        return
      }

      // Resubmission eligibility is judged across the WHOLE submission, not
      // standard by standard: every already-finalized standard with no
      // change of its own was quietly skipped above (see submitStandard), so
      // if literally nothing succeeded anywhere, nothing changed anywhere
      // either — tell the student to change at least one score or comment
      // somewhere, rather than silently doing nothing.
      if (!isDraft && anyFinalized && !anySucceeded) {
        setError('Change at least one score or comment somewhere before resubmitting.')
        return
      }

      // Approach to Learning effort self-rating saves independently of the
      // four standards — it's informational only (doesn't affect the letter
      // grade), so a failure here is never fatal to the overall submission.
      // Skipped entirely if the student never rated it.
      if (effortSelfRating != null) {
        try {
          const atlRes = await fetch(`/api/student/approach-to-learning/${instanceId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ effortStudentScore: effortSelfRating }),
          })
          if (!atlRes.ok) {
            const data = await atlRes.json().catch(() => ({}))
            throw new Error(data.error ?? 'Failed to save Approach to Learning rating')
          }
        } catch (e) {
          rejections.push(`Approach to Learning: ${e instanceof Error ? e.message : 'Failed to save.'}`)
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
        <div className="rounded-2xl bg-success-50 border-2 border-success-200 p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-success-100 mb-3" aria-hidden="true">
            <CheckCircle2 className="h-7 w-7 text-success-600" />
          </div>
          <h2 className="text-lg font-bold text-success-800 mb-2">
            {anyFinalized ? 'Resubmitted!' : 'Work Submitted!'}
          </h2>
          <p className="text-sm text-success-700">
            Your work for {activityName} has been submitted. Your teacher will review it soon.
          </p>
        </div>

        {currentClassScores && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Your Scores - {activityName}</h3>
              {currentClassScores.letterGrade && (
                <span className="text-2xl font-bold text-gray-900">{currentClassScores.letterGrade}</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {standardScores.map(({ label, score }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-gray-400 mb-1">{label}</div>
                  <div className="text-xl font-bold text-gray-800">{score ?? '-'}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="font-semibold text-gray-900 mb-1">All Your Classes</h3>
          <p className="text-xs text-gray-400 mb-4">
            Every score your teachers have given you, by standard, pooled across every class this
            year. Hover a slice to see the breakdown by class.
          </p>
          <StandardDistributionGrid distribution={scoreDistribution} />
        </div>

        <Button
          onClick={() => setSaved(false)}
          variant="destructive"
          className="w-full py-3 rounded-xl"
        >
          Resubmit
        </Button>
      </div>
    )
  }

  const TAB_LABELS: Record<ActiveStd, string> = {
    1: 'Movement Skills',
    2: 'Movement Concepts',
    3: 'Health & Fitness',
    4: 'Teamwork',
    atl: 'Approach to Learning',
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
        <div className="rounded-xl bg-primary-50 border border-primary-200 px-4 py-3 text-sm text-primary-900">
          You've already submitted this work. You can revise your answers and resubmit - just
          change at least one score or edit a comment anywhere below.
        </div>
      )}

      {/* Standard tabs */}
      <div
        className="flex bg-gray-100 rounded-xl p-1 gap-1"
        role="tablist"
        aria-label="Standards"
      >
        {([1, 2, 3, 4, 'atl'] as const).map((n) => (
          <button
            key={n}
            role="tab"
            aria-selected={activeStd === n}
            onClick={() => setActiveStd(n)}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors',
              activeStd === n
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {n !== 'atl' && <span className="hidden sm:inline">Standard {n}: </span>}
            {TAB_LABELS[n]}
          </button>
        ))}
      </div>

      {/* Question section */}
      <div role="tabpanel" className="space-y-4">
        {activeStd !== 'atl' && <ScoringRubricCard rubric={SCORING_RUBRIC[activeStd]} />}
        {activeStd !== 'atl' && teacherGrades?.feedback[activeStd] && (
          <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3">
            <p className="text-xs font-semibold text-purple-900 mb-1">Teacher Feedback</p>
            <p className="text-sm text-purple-800">{teacherGrades.feedback[activeStd]}</p>
          </div>
        )}

        {activeStd === 'atl' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Rate your own effort this rotation. Your teacher rates this separately - both
              ratings, plus attendance/preparedness, feed into your Approach to Learning score.
              This is informational only and does not affect your letter grade.
            </p>
            <SelfRating
              label="How much effort did you put into this class this rotation?"
              name="effort-self-rating"
              value={effortSelfRating}
              onChange={setEffortSelfRating}
              labels={EFFORT_RATING_LABELS}
            />
            {teacherGrades && (
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Teacher&apos;s Approach to Learning Ratings
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-700">Responsible &amp; prepared</span>
                  <TeacherScoreBadge score={teacherGrades.atl.responsiblePrepared} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-700">Respectful &amp; works well</span>
                  <TeacherScoreBadge score={teacherGrades.atl.respectfulWorks} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-700">Effort</span>
                  <TeacherScoreBadge score={teacherGrades.atl.effortTeacherScore} />
                </div>
                {teacherGrades.atl.calculatedScore != null && (
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Overall Approach to Learning score</span>
                    <span className="text-sm font-bold text-gray-900">{teacherGrades.atl.calculatedScore.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeStd === 1 && (
          <div className="space-y-5">
            <p className="text-xs text-gray-500">
              Rate your own performance on each skill. Your teacher will also score these - their
              score is what counts toward your grade.
            </p>
            {skillDefinitions.length === 0 ? (
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-6 text-center text-sm text-gray-400">
                No skills configured for this activity.
              </div>
            ) : (
              <>
                {fundamentalSkills.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Fundamental Movement Assessment
                    </div>
                    <div className="divide-y divide-gray-100">
                      {fundamentalSkills.map((s) => (
                        <SkillSelfRatingRow
                          key={s.id}
                          name={s.skillName}
                          value={skillRatings[s.id] ?? null}
                          onChange={(v) => setSkillRatings((prev) => ({ ...prev, [s.id]: v }))}
                          teacherScore={teacherGrades?.skillScores[s.id]}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {specificSkills.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                      Specific Skill Assessment
                    </div>
                    <div className="divide-y divide-gray-100">
                      {specificSkills.map((s) => (
                        <SkillSelfRatingRow
                          key={s.id}
                          name={s.skillName}
                          value={skillRatings[s.id] ?? null}
                          onChange={(v) => setSkillRatings((prev) => ({ ...prev, [s.id]: v }))}
                          teacherScore={teacherGrades?.skillScores[s.id]}
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
          <div className="space-y-2">
            <SelfRating
              label="How would you rate your teamwork and leadership this rotation?"
              name="self-rating"
              value={selfRating}
              onChange={setSelfRating}
              labels={S4_RATING_LABELS}
            />
            <div className="flex justify-end">
              <TeacherScoreBadge score={teacherGrades?.standard4Rating} />
            </div>
          </div>
        )}

        {(activeStd === 2 || activeStd === 3 || activeStd === 4) && (
          questionSets[activeStd].length === 0 ? (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-6 text-center text-sm text-gray-400">
              No written questions for this activity.
            </div>
          ) : (
            questionSets[activeStd].map((q) => (
              <div key={q.id}>
                <label className="block text-sm font-semibold text-gray-700 mb-2 leading-snug">
                  {q.displayOrder}. {q.promptText}
                </label>
                <textarea
                  value={responses[activeStd]?.[q.displayOrder] ?? ''}
                  onChange={(e) => setResponse(activeStd, q.displayOrder, e.target.value)}
                  rows={4}
                  placeholder="Write your response here…"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
                <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
                  {(activeStd === 2 || activeStd === 3) && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-500">Rate your own answer:</span>
                      <ScoreSelector
                        value={promptRatings[activeStd]?.[q.displayOrder] ?? null}
                        onChange={(v) => setPromptRating(activeStd, q.displayOrder, v)}
                        name={`self-rating-${activeStd}-${q.displayOrder}`}
                      />
                    </div>
                  )}
                  <TeacherScoreBadge score={teacherGrades?.promptScores[q.id]} />
                </div>

                {/* Reassessment box — always available, independent of
                    submission/finalization status. Only fill this in if your
                    teacher has directly told you to redo this question. */}
                <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Reassessment response <span className="text-gray-400">(only if your teacher told you to redo this)</span>
                  </label>
                  <textarea
                    value={reassessmentResponses[activeStd]?.[q.displayOrder] ?? ''}
                    onChange={(e) => setReassessmentResponse(activeStd, q.displayOrder, e.target.value)}
                    rows={3}
                    placeholder="Write your reassessment response here…"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Honor Code */}
      <HonorCodeCheckbox checked={honorCode} onChange={setHonorCode} />

      {error && (
        <p role="alert" className="text-sm text-danger-700 bg-danger-50 rounded-xl px-4 py-3 border border-danger-200">
          {error}
        </p>
      )}

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {!allVisitedStandardsFinalized && (
          <button
            onClick={() => handleSubmit(true)}
            disabled={saving}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-semibold text-sm hover:border-gray-300 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
        )}
        <button
          onClick={() => handleSubmit(false)}
          disabled={!honorCode || saving}
          className="flex-1 py-3 rounded-xl bg-primary-700 text-white font-semibold text-sm hover:bg-primary-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Submitting…' : anyFinalized ? 'Resubmit Work' : 'Submit Work'}
        </button>
      </div>

      {!honorCode && (
        <p className="text-xs text-gray-400 text-center">
          Check the Honor Code above to enable submission.
        </p>
      )}
    </div>
  )
}
