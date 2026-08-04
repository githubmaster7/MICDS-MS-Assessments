import type { StandardRubric } from '@/lib/grading/rubric'

export function ScoringRubricCard({ rubric, collapsedTitle }: { rubric: StandardRubric; collapsedTitle?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        {!collapsedTitle && (
          <h3 className="font-semibold text-gray-900 mb-1">
            Standard {rubric.standardNumber}: {rubric.name}
          </h3>
        )}
        <p className="text-sm text-gray-600">{rubric.description}</p>
      </div>

      <div className="divide-y divide-gray-100">
        {([1, 2, 3, 4] as const).map((level) => (
          <div key={level} className="flex gap-3 px-4 py-2.5 text-sm">
            <span className="shrink-0 font-semibold text-gray-900">Level {level}:</span>
            <span className="text-gray-600">{rubric.levels[level]}</span>
          </div>
        ))}
      </div>

      <div className="px-4 py-2.5 bg-gray-50 border-y border-gray-100">
        <p className="text-sm font-semibold text-gray-900">
          How do these scores translate to my score for this standard?
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {rubric.scoreBreakdown.map((row) => (
          <div key={row.score} className="flex gap-3 px-4 py-2.5 text-sm">
            <span className="shrink-0 font-semibold text-gray-900">{row.score} =</span>
            <span className="text-gray-600">{row.description}</span>
          </div>
        ))}
      </div>

      {rubric.directions && (
        <p className="px-4 py-3 text-sm text-gray-600 border-t border-gray-100">
          <span className="font-semibold text-gray-900">Directions: </span>
          {rubric.directions}
        </p>
      )}

      {rubric.honorCode && rubric.honorCode.length > 0 && (
        <div className="border-t border-danger-200 bg-danger-50">
          {rubric.honorCode.map((line, i) => (
            <p key={i} className="px-4 py-2 text-center text-sm font-bold text-danger-700">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
