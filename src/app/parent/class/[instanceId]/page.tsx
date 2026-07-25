import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { Role } from '@prisma/client'
import { requireParentStudentLink } from '@/lib/authorization'
import { getParentClassDetail } from '@/lib/parent/class-detail'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata: Metadata = { title: 'Class Detail' }

const RATING_LABEL: Record<number, string> = { 4: 'Exceeding', 3: 'Achieving', 2: 'Developing', 1: 'Incomplete' }
const RATING_COLOR: Record<number, string> = {
  4: 'bg-score-exceeding-bg text-score-exceeding-text border-score-exceeding-border',
  3: 'bg-score-achieving-bg text-score-achieving-text border-score-achieving-border',
  2: 'bg-score-developing-bg text-score-developing-text border-score-developing-border',
  1: 'bg-score-incomplete-bg text-score-incomplete-text border-score-incomplete-border',
}

function RatingBadge({ rating }: { rating: number | null }) {
  if (rating === null) {
    return <span className="text-xs text-gray-400 italic">Not rated</span>
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${RATING_COLOR[rating] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {RATING_LABEL[rating] ?? rating} ({rating})
    </span>
  )
}

export default async function ParentClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ instanceId: string }>
  searchParams: Promise<{ studentId?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== Role.PARENT) return notFound()

  const { instanceId } = await params
  const { studentId } = await searchParams
  if (!studentId) return notFound()

  try {
    await requireParentStudentLink(session.user.id, studentId)
  } catch {
    return notFound()
  }

  const detail = await getParentClassDetail(studentId, instanceId)
  if (!detail) return notFound()

  const gradeColorClass: Record<string, string> = {
    A: 'bg-emerald-600', 'A-': 'bg-emerald-500',
    'B+': 'bg-blue-600', B: 'bg-blue-500', 'B-': 'bg-blue-400',
    'C+': 'bg-yellow-500', C: 'bg-yellow-400', 'C-': 'bg-orange-500',
    'D+': 'bg-orange-600', D: 'bg-red-500', 'D-': 'bg-red-600', F: 'bg-red-700',
  }
  const letterGrade = detail.snapshot?.letterGrade ?? null
  const gradeBg = letterGrade ? (gradeColorClass[letterGrade] ?? 'bg-gray-500') : 'bg-gray-300'
  const scoreOf = (v: unknown) => (v != null ? Number(v) : null)

  const feedbackBlock = (score: unknown, feedback: string | null, visible: boolean) => {
    if (!visible) return null
    return (
      <div className="mt-3 bg-primary-50 rounded-lg p-3 text-sm">
        <div className="text-xs text-primary-900 font-medium mb-1">
          Teacher feedback
          {score != null && <span className="ml-2 text-gray-500">· Score: {Number(score).toFixed(2)}</span>}
        </div>
        {feedback ? <p className="text-gray-700">{feedback}</p> : <p className="text-gray-400 italic">No written feedback.</p>}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader
        backHref={`/parent/dashboard?studentId=${studentId}`}
        backLabel="Back to dashboard"
        title={detail.activityName}
        description={
          <>
            <span className="block">
              Class {detail.rotation.rotationNumber} ·{' '}
              {formatDate(detail.rotation.startDate)} –{' '}
              {formatDate(detail.rotation.endDate)}
            </span>
            <span className="block">
              Teacher: {detail.teacher.firstName} {detail.teacher.lastName}
            </span>
          </>
        }
      />

      {detail.snapshot ? (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Grade Summary</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold ${gradeBg}`}>
              {letterGrade ?? '—'}
            </div>
            <div>
              <div className="text-sm text-gray-500">Overall Average</div>
              <div className="text-lg font-semibold text-gray-900">
                {scoreOf(detail.snapshot.overallAverage)?.toFixed(2) ?? '—'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((std) => {
              const score = scoreOf((detail.snapshot as Record<string, unknown>)[`standard${std}Score`])
              return (
                <div key={std} className="bg-white rounded-lg border border-gray-100 p-3">
                  <div className="text-xs text-gray-500 mb-1">Standard {std}</div>
                  <div className="font-semibold text-gray-900">{score?.toFixed(2) ?? '—'}</div>
                </div>
              )
            })}
          </div>
          {detail.snapshot.atlScore != null && (
            <div className="mt-3 bg-purple-50 rounded-lg p-3">
              <div className="text-xs text-purple-600 mb-1">ATL Score</div>
              <div className="font-semibold text-gray-900">{Number(detail.snapshot.atlScore).toFixed(2)}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-6 text-center text-gray-400 text-sm">
          No grade calculated yet.
        </div>
      )}

      {/* Standard 1: Movement Skills */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="font-semibold text-gray-900 mb-1">Standard 1: Movement Skills</h2>
        <p className="text-xs text-gray-400 mb-3">Self-ratings on each skill.</p>
        {detail.standard1.skills.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No skills defined for this activity.</p>
        ) : (
          <div className="space-y-2">
            {detail.standard1.skills.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{s.skillName}</span>
                <RatingBadge rating={s.selfRating} />
              </div>
            ))}
          </div>
        )}
        {feedbackBlock(detail.standard1.teacherScore, detail.standard1.teacherFeedback, detail.standard1.feedbackVisible)}
      </div>

      {/* Standard 2 & 3: written responses + self-ratings */}
      {([
        { std: detail.standard2, num: 2, name: 'Movement Concepts & Sport Strategies' },
        { std: detail.standard3, num: 3, name: 'Health, Fitness & Nutrition' },
      ] as const).map(({ std, num, name }) => (
        <div key={num} className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-1">Standard {num}: {name}</h2>
          <p className="text-xs text-gray-400 mb-3">Written answers and self-ratings.</p>
          {std.prompts.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No questions defined for this activity.</p>
          ) : (
            <div className="space-y-4">
              {std.prompts.map((p) => (
                <div key={p.id}>
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <p className="text-sm font-medium text-gray-800">{p.promptText}</p>
                    <RatingBadge rating={p.selfRating} />
                  </div>
                  {p.response ? (
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{p.response}</p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No answer submitted.</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {feedbackBlock(std.teacherScore, std.teacherFeedback, std.feedbackVisible)}
        </div>
      ))}

      {/* Standard 4: Teamwork & Leadership */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h2 className="font-semibold text-gray-900">Standard 4: Teamwork & Leadership</h2>
          <RatingBadge rating={detail.standard4.selfRating} />
        </div>
        <p className="text-xs text-gray-400 mb-3">Written reflections and overall self-rating.</p>
        {detail.standard4.prompts.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No questions defined for this activity.</p>
        ) : (
          <div className="space-y-4">
            {detail.standard4.prompts.map((p) => (
              <div key={p.id}>
                <p className="text-sm font-medium text-gray-800 mb-1.5">{p.promptText}</p>
                {p.response ? (
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{p.response}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">No answer submitted.</p>
                )}
              </div>
            ))}
          </div>
        )}
        {feedbackBlock(detail.standard4.teacherScore, detail.standard4.teacherFeedback, detail.standard4.feedbackVisible)}
      </div>
    </div>
  )
}
