'use client'
import { useState } from 'react'
import { STANDARD2_QUESTIONS } from '@/lib/skills/standard2-questions'
import { STANDARD3_QUESTIONS } from '@/lib/skills/standard3-questions'
import { STANDARD4_QUESTIONS } from '@/lib/skills/standard4-questions'

const HONOR_CODE_TEXT = `I affirm that the work I am submitting is entirely my own. I have not used AI tools, Google, Canvas resources, or any outside help. I used only my own brain and what I have learned in this class.`

const S4_TEAMWORK_LABELS: Record<number, string> = {
  4: 'The class is better with me in it',
  3: 'I work well with others',
  2: 'I can improve on working with others',
  1: 'The class is worse with me in it',
}

export function StudentSubmissionForm({
  instanceId,
  activityName,
  existingSubmissions,
}: {
  instanceId: string
  activityName: string
  existingSubmissions: Array<{ standardNumber: number; responses: unknown; honorCodeAcknowledged: boolean }>
}) {
  const s2Qs = STANDARD2_QUESTIONS[activityName] ?? []
  const s3Qs = STANDARD3_QUESTIONS[activityName] ?? []
  const s4Qs = STANDARD4_QUESTIONS[activityName] ?? []

  const [responses, setResponses] = useState<Record<number, Record<string, string>>>({2: {}, 3: {}, 4: {}})
  const [teamworkRating, setTeamworkRating] = useState<number>(3)
  const [leadershipRating, setLeadershipRating] = useState<number>(3)
  const [honorCode, setHonorCode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeStd, setActiveStd] = useState<2 | 3 | 4>(2)

  function setResponse(std: number, qKey: string, val: string) {
    setResponses((prev) => ({
      ...prev,
      [std]: { ...(prev[std] ?? {}), [qKey]: val },
    }))
  }

  async function handleSubmit() {
    if (!honorCode) { alert('You must acknowledge the Honor Code before submitting.'); return }
    setSaving(true)
    try {
      const payload = {
        instanceId,
        responses: {
          standard2: responses[2],
          standard3: responses[3],
          standard4: { ...responses[4], teamworkRating, leadershipRating },
        },
        honorCodeAcknowledged: true,
        honorCodeAt: new Date().toISOString(),
      }
      const res = await fetch('/api/student/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await res.text())
      setSaved(true)
    } catch (e) {
      alert(`Submit failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Standard tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {([2, 3, 4] as const).map((n) => (
          <button
            key={n}
            onClick={() => setActiveStd(n)}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${activeStd === n ? 'bg-blue-700 text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Standard {n}
          </button>
        ))}
      </div>

      {/* Standard 2 */}
      {activeStd === 2 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900">Standard 2: Movement Concepts &amp; Sport Strategies</h2>
          {s2Qs.length === 0 ? (
            <p className="text-gray-400 text-sm">No questions defined for this activity.</p>
          ) : s2Qs.map((q) => {
            const qKey = `s2-${q.displayOrder}`
            return (
              <div key={qKey}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{q.promptText}</label>
                <textarea
                  value={responses[2]?.[qKey] ?? ''}
                  onChange={(e) => setResponse(2, qKey, e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Standard 3 */}
      {activeStd === 3 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900">Standard 3: Health, Fitness &amp; Nutrition</h2>
          {s3Qs.map((q) => {
            const qKey = `s3-${q.displayOrder}`
            return (
              <div key={qKey}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{q.promptText}</label>
                <textarea
                  value={responses[3]?.[qKey] ?? ''}
                  onChange={(e) => setResponse(3, qKey, e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Standard 4 */}
      {activeStd === 4 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900">Standard 4: Teamwork &amp; Leadership</h2>

          {/* Self-ratings */}
          <div className="bg-blue-50 rounded-xl p-4">
            <h3 className="font-medium text-gray-800 mb-3 text-sm">Self-Assessment Rating</h3>
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">Teamwork Rating:</label>
              <div className="space-y-1">
                {([4, 3, 2, 1] as const).map((v) => (
                  <label key={v} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-blue-100">
                    <input
                      type="radio"
                      name="teamwork"
                      value={v}
                      checked={teamworkRating === v}
                      onChange={() => setTeamworkRating(v)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">
                      <strong>{v}</strong> — {S4_TEAMWORK_LABELS[v]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Leadership Rating:</label>
              <div className="space-y-1">
                {([4, 3, 2, 1] as const).map((v) => (
                  <label key={v} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-blue-100">
                    <input
                      type="radio"
                      name="leadership"
                      value={v}
                      checked={leadershipRating === v}
                      onChange={() => setLeadershipRating(v)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">
                      <strong>{v}</strong> — {S4_TEAMWORK_LABELS[v]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {s4Qs.map((q) => {
            const qKey = `s4-${q.displayOrder}`
            return (
              <div key={qKey}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{q.promptText}</label>
                <textarea
                  value={responses[4]?.[qKey] ?? ''}
                  onChange={(e) => setResponse(4, qKey, e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Honor Code */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <h3 className="font-semibold text-gray-800 mb-2 text-sm">Honor Code</h3>
        <p className="text-sm text-gray-700 mb-3">{HONOR_CODE_TEXT}</p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={honorCode}
            onChange={(e) => setHonorCode(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm font-medium text-gray-700">
            I acknowledge and affirm the Honor Code above
          </span>
        </label>
      </div>

      {saved ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm text-center font-medium">
          Your work has been submitted successfully!
        </div>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!honorCode || saving}
          className="w-full py-3 bg-blue-700 text-white rounded-xl font-medium hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Submitting…' : 'Submit Work'}
        </button>
      )}

      {!honorCode && (
        <p className="text-xs text-red-600 text-center">
          You must acknowledge the Honor Code before submitting.
        </p>
      )}
    </div>
  )
}
