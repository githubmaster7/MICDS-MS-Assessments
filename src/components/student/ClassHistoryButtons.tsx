'use client'

import { useState } from 'react'
import { StudentHistoryModal } from '@/components/shared/StudentHistoryModal'

/**
 * Student-facing counterpart to the teacher's per-student history buttons
 * on the Class Analytics page — same modal, same data shapes, pointed at
 * the student-scoped history endpoint instead of the teacher one.
 */
export function ClassHistoryButtons({
  instanceId,
  studentName,
}: {
  instanceId: string
  studentName: string
}) {
  const [mode, setMode] = useState<'resubmission' | 'grading' | null>(null)

  return (
    <>
      <div className="flex items-center gap-3 pt-3 mt-3 border-t border-gray-100">
        <button
          onClick={() => setMode('resubmission')}
          className="text-xs font-medium text-primary-900 hover:text-primary-900 hover:underline"
        >
          My resubmission history
        </button>
        <button
          onClick={() => setMode('grading')}
          className="text-xs font-medium text-purple-600 hover:text-purple-800 hover:underline"
        >
          Teacher regrade history
        </button>
      </div>

      {mode && (
        <StudentHistoryModal
          studentName={studentName}
          apiUrl={`/api/student/grades/${instanceId}`}
          mode={mode}
          onClose={() => setMode(null)}
        />
      )}
    </>
  )
}
