'use client'

import { useState } from 'react'

export type ValidScore = 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4

const SCORE_OPTIONS: ValidScore[] = [1, 1.5, 2, 2.5, 3, 3.5, 4]

const SCORE_LABELS: Record<number, string> = {
  1: 'Beginning',
  1.5: 'Beginning+',
  2: 'Developing',
  2.5: 'Developing+',
  3: 'Proficient',
  3.5: 'Proficient+',
  4: 'Advanced',
}

const SCORE_COLORS: Record<number, string> = {
  1: 'bg-red-400 text-white border-red-500',
  1.5: 'bg-red-300 text-red-900 border-red-400',
  2: 'bg-yellow-300 text-yellow-900 border-yellow-400',
  2.5: 'bg-yellow-200 text-yellow-800 border-yellow-300',
  3: 'bg-green-200 text-green-800 border-green-300',
  3.5: 'bg-green-300 text-green-900 border-green-400',
  4: 'bg-emerald-500 text-white border-emerald-600',
}

export interface StudentResponse {
  questionText: string
  studentAnswer: string | null
}

export interface ReassessmentData {
  submittedAt: Date
  response: string
  status: 'PENDING' | 'REVIEWED'
}

interface Standard234GraderProps {
  standardNumber: 2 | 3 | 4
  studentResponses?: StudentResponse[]
  teacherScore: ValidScore
  onScoreChange: (v: ValidScore) => void
  feedbackText: string
  onFeedbackChange: (v: string) => void
  isFeedbackVisible: boolean
  onVisibleChange: (v: boolean) => void
  reassessment?: ReassessmentData | null
}

const STANDARD_NAMES: Record<2 | 3 | 4, string> = {
  2: 'Movement Concepts & Sport Strategies',
  3: 'Health, Fitness & Nutrition',
  4: 'Teamwork & Leadership',
}

export function Standard234Grader({
  standardNumber,
  studentResponses,
  teacherScore,
  onScoreChange,
  feedbackText,
  onFeedbackChange,
  isFeedbackVisible,
  onVisibleChange,
  reassessment,
}: Standard234GraderProps) {
  const [showReassessment, setShowReassessment] = useState(false)
  const maxFeedbackLen = 500

  return (
    <div className="space-y-4">
      {/* Student responses */}
      {studentResponses && studentResponses.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Student Responses
          </div>
          {studentResponses.map((r, i) => (
            <div key={i} className="bg-slate-50 rounded-lg border border-slate-200 p-3">
              <div className="text-xs font-medium text-slate-600 mb-1.5">{r.questionText}</div>
              {r.studentAnswer ? (
                <p className="text-sm text-slate-800 leading-relaxed">{r.studentAnswer}</p>
              ) : (
                <p className="text-sm text-slate-400 italic">No response submitted.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Score selector */}
      <div>
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Teacher Score
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Standard ${standardNumber} score`}>
          {SCORE_OPTIONS.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={teacherScore === v}
              onClick={() => onScoreChange(v)}
              title={SCORE_LABELS[v]}
              className={`px-3 py-1.5 rounded-lg border-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1 ${
                teacherScore === v
                  ? SCORE_COLORS[v] + ' scale-105 shadow-sm'
                  : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="mt-1.5 text-xs text-slate-500">
          Selected: <span className="font-medium text-slate-700">{SCORE_LABELS[teacherScore]}</span>
        </div>
      </div>

      {/* Feedback */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Feedback
          </div>
          <span className="text-xs text-slate-400 tabular-nums">
            {feedbackText.length}/{maxFeedbackLen}
          </span>
        </div>
        <textarea
          value={feedbackText}
          onChange={(e) => onFeedbackChange(e.target.value.slice(0, maxFeedbackLen))}
          rows={3}
          placeholder="Optional: write feedback for the student…"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none leading-relaxed"
        />
        <label className="flex items-center gap-2 mt-1.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={isFeedbackVisible}
            onChange={(e) => onVisibleChange(e.target.checked)}
            className="w-4 h-4 rounded accent-blue-600"
          />
          <span className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors select-none">
            Visible to student
          </span>
          {isFeedbackVisible && (
            <span className="text-xs text-blue-600 font-medium">Student will see this</span>
          )}
        </label>
      </div>

      {/* Reassessment */}
      {reassessment && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-3">
          <button
            type="button"
            onClick={() => setShowReassessment((v) => !v)}
            className="flex items-center justify-between w-full text-sm font-medium text-amber-800"
          >
            <span>
              Reassessment submitted
              {reassessment.status === 'PENDING' && (
                <span className="ml-2 px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded text-xs">Pending review</span>
              )}
            </span>
            <span className="text-amber-600 text-xs">{showReassessment ? 'Hide' : 'Show'}</span>
          </button>
          {showReassessment && (
            <div className="mt-3 space-y-2">
              <div className="text-xs text-amber-700">
                Submitted {reassessment.submittedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <div className="bg-white border border-amber-200 rounded-lg p-2.5 text-sm text-slate-800">
                {reassessment.response}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
