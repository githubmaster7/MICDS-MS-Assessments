'use client'

import { useState } from 'react'
import { HonorCodeCheckbox } from './HonorCodeCheckbox'
import { cn } from '@/lib/utils'
import type { Standard2Question } from '@/lib/skills/standard2-questions'

const S4_RATING_LABELS: Record<number, { short: string; long: string; color: string }> = {
  4: { short: '4 — Outstanding', long: 'The class is better with me in it', color: 'border-emerald-400 bg-emerald-50 text-emerald-800' },
  3: { short: '3 — Good',        long: 'I work well with others',           color: 'border-blue-400 bg-blue-50 text-blue-800' },
  2: { short: '2 — Developing',  long: 'I can improve on working with others', color: 'border-amber-400 bg-amber-50 text-amber-800' },
  1: { short: '1 — Beginning',   long: 'The class is worse with me in it',   color: 'border-red-400 bg-red-50 text-red-800' },
}

interface Question {
  promptText: string
  displayOrder: number
}

interface ExistingSubmission {
  standardNumber: number
  honorCodeAcknowledged?: boolean
}

interface SubmissionFormProps {
  instanceId: string
  activityName: string
  standard2Questions: Question[]
  standard3Questions: Question[]
  standard4Questions: Question[]
  existingSubmissions?: ExistingSubmission[]
  reassessmentAllowed?: boolean
}

type ActiveStd = 2 | 3 | 4

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
  standard2Questions,
  standard3Questions,
  standard4Questions,
  existingSubmissions = [],
  reassessmentAllowed = false,
}: SubmissionFormProps) {
  const alreadySubmitted = existingSubmissions.some((s) => s.honorCodeAcknowledged)

  const [activeStd, setActiveStd] = useState<ActiveStd>(2)
  const [responses, setResponses] = useState<Record<number, Record<number, string>>>({
    2: {},
    3: {},
    4: {},
  })
  const [teamworkRating, setTeamworkRating] = useState(3)
  const [leadershipRating, setLeadershipRating] = useState(3)
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

  async function handleSubmit(isDraft: boolean) {
    if (!isDraft && !honorCode) {
      setError('You must acknowledge the Honor Code before submitting.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      // Submit each standard
      for (const stdNum of [2, 3, 4] as const) {
        const body = {
          instanceId,
          standardNumber: stdNum,
          honorCodeAcknowledged: !isDraft && honorCode,
          responses:
            stdNum === 4
              ? { ...responses[4], teamworkRating, leadershipRating }
              : responses[stdNum],
          isDraft,
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
      }
      if (!isDraft) setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 p-8 text-center">
        <div className="text-4xl mb-3" aria-hidden="true">✓</div>
        <h2 className="text-lg font-bold text-emerald-800 mb-2">Work Submitted!</h2>
        <p className="text-sm text-emerald-700">
          Your work for {activityName} has been submitted. Your teacher will review it soon.
        </p>
      </div>
    )
  }

  if (alreadySubmitted && !reassessmentAllowed) {
    return (
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-8 text-center">
        <div className="text-4xl mb-3" aria-hidden="true">📬</div>
        <h2 className="text-lg font-bold text-slate-700 mb-2">Already Submitted</h2>
        <p className="text-sm text-slate-500">
          You have already submitted your work for this class. Reassessment is not currently
          available for this assignment.
        </p>
      </div>
    )
  }

  const TAB_LABELS: Record<ActiveStd, string> = {
    2: 'Movement Concepts',
    3: 'Health & Fitness',
    4: 'Teamwork',
  }

  const questionSets: Record<ActiveStd, Question[]> = {
    2: standard2Questions,
    3: standard3Questions,
    4: standard4Questions,
  }

  return (
    <div className="space-y-5">
      {reassessmentAllowed && alreadySubmitted && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
          Reassessment is allowed for this assignment. You may update and resubmit your work.
        </div>
      )}

      {/* Standard tabs */}
      <div
        className="flex bg-slate-100 rounded-xl p-1 gap-1"
        role="tablist"
        aria-label="Standards"
      >
        {([2, 3, 4] as const).map((n) => (
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
        {activeStd === 4 && (
          <div className="space-y-4">
            <SelfRating
              label="How would you rate your teamwork this rotation?"
              name="teamwork"
              value={teamworkRating}
              onChange={setTeamworkRating}
            />
            <SelfRating
              label="How would you rate your leadership this rotation?"
              name="leadership"
              value={leadershipRating}
              onChange={setLeadershipRating}
            />
          </div>
        )}

        {questionSets[activeStd].length === 0 ? (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-6 text-center text-sm text-slate-400">
            No written questions for this activity.
          </div>
        ) : (
          questionSets[activeStd].map((q, i) => (
            <div key={i}>
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
            </div>
          ))
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
        <button
          onClick={() => handleSubmit(true)}
          disabled={saving}
          className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold text-sm hover:border-slate-300 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Draft'}
        </button>
        <button
          onClick={() => handleSubmit(false)}
          disabled={!honorCode || saving}
          className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Submitting…' : 'Submit Work'}
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
