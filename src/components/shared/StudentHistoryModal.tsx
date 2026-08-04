'use client'

import { useEffect, useState } from 'react'

type Score = 1 | 2 | 3 | 4

const COLOR_CLASSES: Record<Score, string> = {
  1: 'bg-score-incomplete-bg border-score-incomplete-border text-score-incomplete-text',
  2: 'bg-score-developing-bg border-score-developing-border text-score-developing-text',
  3: 'bg-score-achieving-bg border-score-achieving-border text-score-achieving-text',
  4: 'bg-score-exceeding-bg border-score-exceeding-border text-score-exceeding-text',
}

const STANDARD_NAMES: Record<1 | 2 | 3 | 4, string> = {
  1: 'Standard 1: Movement Skills',
  2: 'Standard 2: Movement Concepts & Sport Strategies',
  3: 'Standard 3: Health, Fitness & Nutrition',
  4: 'Standard 4: Teamwork & Leadership',
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface StudentHistoryAttempt {
  attemptNumber: number
  submittedAt: string
  writtenResponses: { promptDefinitionId: string; responseText: string }[]
  skillSelfRatings: { skillDefinitionId: string; rating: number }[]
  promptSelfRatings: { promptDefinitionId: string; rating: number }[]
  standard4SelfRating: number | null
}

interface GradeHistoryEntry {
  id: string
  createdAt: string
  actorEmail: string | null
  beforeValue: { score?: number | null; feedback?: string | null } | null
  afterValue: { score?: number | null; feedback?: string | null } | null
}

interface GradesResponse {
  studentHistory: Record<1 | 2 | 3 | 4, StudentHistoryAttempt[]>
  gradeHistory: Record<1 | 2 | 3 | 4, GradeHistoryEntry[]>
  attemptCount: Record<1 | 2 | 3 | 4, number>
}

/**
 * Shared "history" modal — used by the teacher's Class Analytics page
 * (per-student cards) and by the student's own class detail page. One mode
 * shows the student's own resubmission history, the other shows the
 * teacher's grading history. Both are tabbed by standard, since history is
 * inherently per-standard, and both lazily fetch from a caller-supplied URL
 * so each role hits its own authorization-scoped endpoint while sharing one
 * rendering implementation.
 */
export function StudentHistoryModal({
  studentName,
  apiUrl,
  mode,
  onClose,
}: {
  studentName: string
  /** Full URL to fetch — teacher and student pages each point this at their own scoped endpoint. */
  apiUrl: string
  mode: 'resubmission' | 'grading'
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<GradesResponse | null>(null)
  const [tab, setTab] = useState<1 | 2 | 3 | 4>(1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(apiUrl)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setData(d?.data ?? null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [apiUrl])

  const title = mode === 'resubmission' ? 'Student resubmission history' : 'Teacher grading history'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-gray-900">
            {studentName} - {title}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            &times;
          </button>
        </div>
        <div className="flex gap-1 px-4 pt-3 border-b border-gray-100 sticky top-[57px] bg-white z-10 flex-wrap">
          {([1, 2, 3, 4] as const).map((std) => (
            <button
              key={std}
              onClick={() => setTab(std)}
              className={`text-xs font-medium px-2.5 py-1.5 rounded-t-lg border-b-2 ${
                tab === std ? 'border-primary-600 text-primary-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Standard {std}
            </button>
          ))}
        </div>
        <div className="p-4">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
          ) : !data ? (
            <p className="text-sm text-red-500 text-center py-6">Failed to load history.</p>
          ) : mode === 'resubmission' ? (
            <ResubmissionTimeline attempts={data.studentHistory[tab]} />
          ) : (
            <GradingTimeline entries={data.gradeHistory[tab]} />
          )}
        </div>
      </div>
    </div>
  )
}

function ResubmissionTimeline({ attempts }: { attempts: StudentHistoryAttempt[] }) {
  if (attempts.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">No submission yet for this standard.</p>
  }
  return (
    <div className="space-y-3">
      {attempts.map((attempt, i) => (
        <div key={attempt.attemptNumber} className="border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-800">
              Attempt {attempt.attemptNumber}
              {i === attempts.length - 1 ? ' (latest)' : ''}
            </span>
            <span className="text-xs text-gray-400">{formatDateTime(attempt.submittedAt)}</span>
          </div>
          {attempt.writtenResponses.map((wr) => (
            <p key={wr.promptDefinitionId} className="text-sm text-gray-700 bg-gray-50 rounded p-2 mb-2">
              {wr.responseText}
            </p>
          ))}
          {attempt.skillSelfRatings.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {attempt.skillSelfRatings.map((sr) => (
                <span
                  key={sr.skillDefinitionId}
                  className={`px-2 py-0.5 rounded text-xs font-medium border ${COLOR_CLASSES[sr.rating as Score]}`}
                >
                  Self-score: {sr.rating}
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
            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium border ${COLOR_CLASSES[attempt.standard4SelfRating as Score]}`}>
              Teamwork/leadership self-rating: {attempt.standard4SelfRating}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function GradingTimeline({ entries }: { entries: GradeHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">No grading changes recorded yet.</p>
  }
  return (
    <div className="space-y-3">
      {entries.map((entry, i) => (
        <div key={entry.id} className="border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-800">
              Change {i + 1}
              {i === entries.length - 1 ? ' (latest)' : ''}
            </span>
            <span className="text-xs text-gray-400">{formatDateTime(entry.createdAt)}</span>
            {entry.actorEmail && <span className="text-xs text-gray-400">by {entry.actorEmail}</span>}
          </div>
          <div className="text-sm text-gray-700 space-y-1">
            <div>
              Score: {entry.beforeValue?.score ?? '-'} → <strong>{entry.afterValue?.score ?? '-'}</strong>
            </div>
            {entry.beforeValue?.feedback !== entry.afterValue?.feedback && (
              <div>
                Feedback: <span className="text-gray-500">{entry.beforeValue?.feedback || '(none)'}</span> →{' '}
                <span className="text-gray-900">{entry.afterValue?.feedback || '(none)'}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export { STANDARD_NAMES }
