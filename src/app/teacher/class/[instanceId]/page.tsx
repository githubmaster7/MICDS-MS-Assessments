'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { GroupStandardDistributionGrid, type GroupScoreBucket } from '@/components/teacher/GroupScoreDistributionChart'
import { StudentHistoryModal } from '@/components/teacher/StudentHistoryModal'

type Score = 1 | 2 | 3 | 4

const SCORE_BADGE_COLOR: Record<string, string> = {
  '4': 'bg-emerald-500 text-white',
  '3.5': 'bg-green-400 text-white',
  '3': 'bg-green-300 text-green-900',
  '2.5': 'bg-yellow-300 text-yellow-900',
  '2': 'bg-yellow-200 text-yellow-800',
  '1.5': 'bg-orange-300 text-orange-900',
  '1': 'bg-red-400 text-white',
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

interface AnalyticsResponse {
  groupName: string
  activityName: string
  status: string
  distributions: Record<1 | 2 | 3 | 4, GroupScoreBucket[]>
  atlSummary: Record<'responsiblePrepared' | 'respectfulWorks' | 'effortTeacherScore', ATLCategorySummary>
  roster: RosterRow[]
}

export default function ClassAnalyticsPage() {
  const params = useParams<{ instanceId: string }>()
  const instanceId = params.instanceId

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [historyTarget, setHistoryTarget] = useState<{ studentId: string; studentName: string; mode: 'resubmission' | 'grading' } | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/teacher/classes/${instanceId}/analytics`)
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d?.error ?? 'Failed to load class analytics.')
        setData(d.data)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load class analytics.'))
      .finally(() => setLoading(false))
  }, [instanceId])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <Link href={`/teacher/grade/students?instanceId=${instanceId}`} className="text-sm text-blue-600 hover:underline">
          ← Back to grading
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Class Analytics</h1>
        {data && (
          <p className="text-gray-500 text-sm mt-1">
            {data.activityName} · {data.groupName}
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">{error}</div>
      ) : data ? (
        <>
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Standard Score Distribution — Whole Class</h2>
            <GroupStandardDistributionGrid distributions={data.distributions} />
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Approach to Learning</h2>
            <p className="text-xs text-gray-400 mb-3">Informational only — does not affect the overall letter grade.</p>
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
                          {summary.average !== null ? summary.average.toFixed(2) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {summary.buckets.length === 0 ? (
                              <span className="text-xs text-gray-400">No ratings yet</span>
                            ) : (
                              summary.buckets.map((b) => (
                                <span
                                  key={b.score}
                                  title={`Score ${b.score}: ${b.total} — ${b.byStudent.map((s) => `${s.studentName}: ${s.count}`).join(', ')}`}
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
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Students</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.roster.map((row) => (
                <div key={row.studentProfileId} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">{row.studentName}</span>
                    <span className="text-sm font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-800">
                      {row.letterGrade ?? '—'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {([1, 2, 3, 4] as const).map((std) => (
                      <span
                        key={std}
                        className={`text-xs font-medium px-1.5 py-0.5 rounded ${SCORE_BADGE_COLOR[String(row.standards[std] ?? '')] ?? 'bg-gray-100 text-gray-500'}`}
                      >
                        {STANDARD_LABELS[std]}: {row.standards[std] ?? '—'}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(['responsiblePrepared', 'respectfulWorks', 'effortTeacherScore'] as const).map((cat) => (
                      <span key={cat} className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">
                        {ATL_CATEGORY_LABELS[cat].split(' ')[0]}: {row.atl[cat] ?? '—'}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => setHistoryTarget({ studentId: row.studentProfileId, studentName: row.studentName, mode: 'resubmission' })}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
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
        </>
      ) : null}

      {historyTarget && (
        <StudentHistoryModal
          studentId={historyTarget.studentId}
          studentName={historyTarget.studentName}
          instanceId={instanceId}
          mode={historyTarget.mode}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  )
}
