'use client'

type Rating = 1 | 2 | 3 | 4

const RATING_LABELS: Record<Rating, string> = {
  1: 'Beginning',
  2: 'Developing',
  3: 'Proficient',
  4: 'Advanced',
}

const RATING_BG: Record<Rating, string> = {
  1: 'bg-red-100 text-red-700 border-red-200',
  2: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  3: 'bg-green-100 text-green-700 border-green-200',
  4: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

interface Standard4SelfRatingProps {
  studentRating: Rating
  teacherRating: Rating
  onTeacherRatingChange: (v: Rating) => void
}

export function Standard4SelfRating({
  studentRating,
  teacherRating,
  onTeacherRatingChange,
}: Standard4SelfRatingProps) {
  const gap = Math.abs(teacherRating - studentRating)
  const showGapWarning = gap > 1

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Student self-rating */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Student Self-Rating
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-lg font-bold ${RATING_BG[studentRating]}`}>
              {studentRating}
            </div>
            <div>
              <div className="text-sm font-medium text-slate-800">{RATING_LABELS[studentRating]}</div>
              <div className="text-xs text-slate-500">Self-assessed</div>
            </div>
          </div>
        </div>

        {/* Teacher rating */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Teacher Rating
          </div>
          <div className="flex gap-1.5" role="radiogroup" aria-label="Teacher rating for Standard 4">
            {([1, 2, 3, 4] as Rating[]).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={teacherRating === v}
                onClick={() => onTeacherRatingChange(v)}
                className={`w-9 h-9 rounded-lg border-2 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  teacherRating === v
                    ? RATING_BG[v] + ' scale-105 shadow-sm border-current'
                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            {RATING_LABELS[teacherRating]}
          </div>
        </div>
      </div>

      {/* Gap indicator */}
      <div className={`rounded-lg border p-3 flex items-center gap-3 transition-colors ${
        showGapWarning
          ? 'bg-amber-50 border-amber-200'
          : gap === 0
          ? 'bg-slate-50 border-slate-200'
          : 'bg-blue-50 border-blue-100'
      }`}>
        <div className="flex items-center gap-2 flex-1">
          {/* Visual gap scale */}
          <div className="flex gap-0.5">
            {([1, 2, 3, 4] as Rating[]).map((v) => (
              <div
                key={v}
                className={`w-6 h-2 rounded-sm transition-colors ${
                  v >= Math.min(studentRating, teacherRating) && v <= Math.max(studentRating, teacherRating)
                    ? showGapWarning ? 'bg-amber-400' : 'bg-blue-400'
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
          <div className="text-xs text-slate-600">
            {gap === 0 ? (
              <span className="text-slate-500">Ratings match</span>
            ) : (
              <>
                <span className={showGapWarning ? 'text-amber-700 font-medium' : 'text-blue-700'}>
                  {gap}-point gap
                </span>
                {showGapWarning && (
                  <span className="text-amber-600 ml-1">— consider a conversation with the student</span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="text-xs tabular-nums text-slate-500 shrink-0">
          Student {studentRating} / Teacher {teacherRating}
        </div>
      </div>
    </div>
  )
}
