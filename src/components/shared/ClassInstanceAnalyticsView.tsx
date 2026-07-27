'use client'

import { useEffect, useState } from 'react'
import { GroupStandardDistributionGrid, type GroupScoreBucket } from '@/components/teacher/GroupScoreDistributionChart'
import { StudentHistoryModal } from '@/components/shared/StudentHistoryModal'

const SCORE_BADGE_COLOR: Record<string, string> = {
  '4': 'bg-score-exceeding text-black',
  '3.5': 'bg-score-achieving text-black',
  '3': 'bg-score-achieving text-black',
  '2.5': 'bg-score-developing text-black',
  '2': 'bg-score-developing text-black',
  '1.5': 'bg-score-incomplete text-black',
  '1': 'bg-score-incomplete text-black',
}

const STANDARD_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'S1',
  2: 'S2',
  3: 'S3',
  4: 'S4',
}

const ATL_CATEGORY_LABELS: Record<string, string> = {
  responsiblePrepared: 'Responsible & Prepared for Class',
  respectfulWorks: 'Respectful and Works Well with Others',
  effortTeacherScore: 'Puts Forth Effort to Learn',
}

// Short form for the compact per-student roster card — the full label's
// first word isn't always a sensible abbreviation on its own (e.g. "Puts
// Forth Effort to Learn" starts with "Puts", not the word that actually
// identifies the category), so this is spelled out explicitly per category
// rather than derived by splitting the full label.
const ATL_CATEGORY_SHORT_LABELS: Record<string, string> = {
  responsiblePrepared: 'Responsible',
  respectfulWorks: 'Respectful',
  effortTeacherScore: 'Effort',
}

interface ATLCategorySummary {
  average: number | null
  buckets: GroupScoreBucket[]
}

interface RosterRow {
  studentProfileId: string
  studentName: string
  letterGrade: string | null
  standards: Record<1 | 2 | 3 | 4, number | null>
  atl: { responsiblePrepared: number | null; respectfulWorks: number | null; effortTeacherScore: number | null }
  resubmissionCount: number
}

export interface ClassInstanceAnalyticsData {
  groupName: string
  activityName: string
  teacherName?: string
  status: string
  distributions: Record<1 | 2 | 3 | 4, GroupScoreBucket[]>
  atlSummary: Record<'responsiblePrepared' | 'respectfulWorks' | 'effortTeacherScore', ATLCategorySummary>
  roster: RosterRow[]
}

/**
 * Shared "one class instance's analytics" body — 4 standard distribution
 * graphs, the ATL average table, and a per-student roster card with history
 * buttons. Used by the teacher's own Class Analytics page and by every
 * admin Group/Teacher/Class detail view, all pointed at their own
 * authorization-scoped endpoints, so the three roles can never show
 * different numbers for the same instance.
 */
export function ClassInstanceAnalyticsView({
  analyticsApiUrl,
  historyApiUrlFor,
  compact = false,
  onLoad,
}: {
  analyticsApiUrl: string
  historyApiUrlFor: (studentId: string) => string
  /** Compact mode omits the section headings, for embedding several instances on one page. */
  compact?: boolean
  /** Fires once analytics data loads — lets the parent page render its own header (e.g. activity/group name) from the same fetch. */
  onLoad?: (data: ClassInstanceAnalyticsData) => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ClassInstanceAnalyticsData | null>(null)
  const [historyTarget, setHistoryTarget] = useState<{ studentId: string; studentName: string; mode: 'resubmission' | 'grading' } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(analyticsApiUrl)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d?.error ?? 'Failed to load class analytics.')
        if (!cancelled) {
          setData(d.data)
          onLoad?.(d.data)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load class analytics.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [analyticsApiUrl])

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>
  if (error) return <div className="bg-danger-50 border border-danger-200 text-danger-700 text-sm rounded-lg p-4">{error}</div>
  if (!data) return null

  return (
    <div className="space-y-6">
      <section>
        {!compact && <h2 className="text-sm font-semibold text-gray-700 mb-3">Standard Score Distribution - Whole Class</h2>}
        <GroupStandardDistributionGrid distributions={data.distributions} />
      </section>

      <section>
        {!compact && (
          <>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Approach to Learning</h2>
            <p className="text-xs text-gray-400 mb-3">Informational only - does not affect the overall letter grade.</p>
          </>
        )}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Class Average</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Distribution (hover for counts)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(Object.keys(ATL_CATEGORY_LABELS) as Array<keyof typeof ATL_CATEGORY_LABELS>).map((category) => {
                const summary = data.atlSummary[category]
                return (
                  <tr key={category}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{ATL_CATEGORY_LABELS[category]}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">
                      {summary.average !== null ? summary.average.toFixed(2) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {summary.buckets.length === 0 ? (
                          <span className="text-xs text-gray-400">No ratings yet</span>
                        ) : (
                          summary.buckets.map((b) => (
                            <span
                              key={b.score}
                              title={`Score ${b.score}: ${b.total} - ${b.byStudent.map((s) => `${s.studentName}: ${s.count}`).join(', ')}`}
                              className={`text-xs font-semibold px-1.5 py-0.5 rounded cursor-default ${SCORE_BADGE_COLOR[String(b.score)] ?? 'bg-gray-100 text-gray-700'}`}
                            >
                              {b.score}: {b.total}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        {!compact && <h2 className="text-sm font-semibold text-gray-700 mb-3">Students</h2>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.roster.map((row) => (
            <div key={row.studentProfileId} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900">{row.studentName}</span>
                <span className="text-sm font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-800">
                  {row.letterGrade ?? '-'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {([1, 2, 3, 4] as const).map((std) => (
                  <span
                    key={std}
                    className={`text-xs font-medium px-1.5 py-0.5 rounded ${SCORE_BADGE_COLOR[String(row.standards[std] ?? '')] ?? 'bg-gray-100 text-gray-500'}`}
                  >
                    {STANDARD_LABELS[std]}: {row.standards[std] ?? '-'}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(['responsiblePrepared', 'respectfulWorks', 'effortTeacherScore'] as const).map((cat) => (
                  <span key={cat} className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
                    {ATL_CATEGORY_SHORT_LABELS[cat]}: {row.atl[cat] ?? '-'}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                <button
                  onClick={() => setHistoryTarget({ studentId: row.studentProfileId, studentName: row.studentName, mode: 'resubmission' })}
                  className="text-xs font-medium text-primary-900 hover:text-primary-900 hover:underline"
                >
                  Student resubmission history
                </button>
                <button
                  onClick={() => setHistoryTarget({ studentId: row.studentProfileId, studentName: row.studentName, mode: 'grading' })}
                  className="text-xs font-medium text-purple-600 hover:text-purple-800 hover:underline"
                >
                  Teacher grading history
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {historyTarget && (
        <StudentHistoryModal
          studentName={historyTarget.studentName}
          apiUrl={historyApiUrlFor(historyTarget.studentId)}
          mode={historyTarget.mode}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  )
}
