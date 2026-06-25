'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ActivePlan = {
  id: string
  name: string
  positions: Array<{
    id: string
    positionOrder: number
    teacher: { teacherProfile: { firstName: string; lastName: string } | null } | null
    activityTemplate: { name: string } | null
  }>
  schoolYear: { name: string }
} | null

type RotationHistoryItem = {
  id: string
  executedAt: Date
  notes: string | null
  executedByUser: { email: string } | null
}

type ActiveAssignment = {
  id: string
  studentGroup: { name: string }
  teacher: { teacherProfile: { firstName: string; lastName: string } | null } | null
  activityTemplate: { name: string } | null
}

export function CarouselManager({
  activePlan,
  rotationHistory,
  activeAssignments,
}: {
  activePlan: ActivePlan
  rotationHistory: RotationHistoryItem[]
  activeAssignments: ActiveAssignment[]
}) {
  const router = useRouter()
  const [confirmText, setConfirmText] = useState('')
  const [preview, setPreview] = useState<object | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [loadingRotate, setLoadingRotate] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handlePreview() {
    setLoadingPreview(true)
    try {
      const res = await fetch('/api/admin/carousel/preview')
      const data = await res.json()
      setPreview(data)
      setShowConfirm(true)
    } catch {
      alert('Failed to load preview')
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleRotate() {
    if (confirmText !== 'ROTATE') { alert('Type ROTATE to confirm.'); return }
    setLoadingRotate(true)
    try {
      const res = await fetch('/api/admin/carousel/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      if (!res.ok) throw new Error(await res.text())
      setShowConfirm(false)
      setConfirmText('')
      setPreview(null)
      router.refresh()
      alert('Rotation executed successfully!')
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setLoadingRotate(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Current assignments */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Current Assignments</h2>
        {activeAssignments.length === 0 ? (
          <p className="text-gray-400 text-sm">No active assignments.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-2 text-left text-gray-500 font-medium">Student Group</th>
                  <th className="pb-2 text-left text-gray-500 font-medium">Teacher</th>
                  <th className="pb-2 text-left text-gray-500 font-medium">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activeAssignments.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 font-medium">{a.studentGroup.name}</td>
                    <td className="py-2 text-gray-600">
                      {a.teacher?.teacherProfile
                        ? `${a.teacher.teacherProfile.firstName} ${a.teacher.teacherProfile.lastName}`
                        : '—'}
                    </td>
                    <td className="py-2 text-gray-600">{a.activityTemplate?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Carousel plan */}
      {activePlan && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">
            Carousel Plan: {activePlan.name}
          </h2>
          <p className="text-sm text-gray-500 mb-3">{activePlan.schoolYear.name}</p>
          <div className="space-y-2">
            {activePlan.positions.map((pos) => (
              <div key={pos.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {pos.positionOrder}
                </div>
                <div>
                  <span className="font-medium text-sm">
                    {pos.teacher?.teacherProfile
                      ? `${pos.teacher.teacherProfile.firstName} ${pos.teacher.teacherProfile.lastName}`
                      : 'No teacher'}
                  </span>
                  <span className="text-gray-400 text-sm mx-2">→</span>
                  <span className="text-gray-700 text-sm">{pos.activityTemplate?.name ?? '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rotate action */}
      <div className="bg-white rounded-xl border border-orange-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-2">Rotate Classes</h2>
        <p className="text-sm text-gray-500 mb-4">
          Move each teacher/class to the next student group. Student groups stay fixed.
          This action is permanent and will be audit logged.
        </p>
        <button
          onClick={handlePreview}
          disabled={loadingPreview}
          className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50"
        >
          {loadingPreview ? 'Loading preview…' : 'Preview Next Rotation'}
        </button>
      </div>

      {/* Rotation history */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Rotation History</h2>
        {rotationHistory.length === 0 ? (
          <p className="text-gray-400 text-sm">No rotations executed yet.</p>
        ) : (
          <div className="space-y-2">
            {rotationHistory.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                <div>
                  <span className="font-medium">{r.executedAt.toLocaleDateString()}</span>
                  <span className="text-gray-500 ml-2">by {r.executedByUser?.email ?? 'system'}</span>
                  {r.notes && <span className="text-gray-400 ml-2">— {r.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm rotation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Confirm Rotation</h3>
            {preview && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm overflow-auto max-h-48">
                <pre className="text-xs">{JSON.stringify(preview, null, 2)}</pre>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <strong>ROTATE</strong> to confirm
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="ROTATE"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
            <p className="text-xs text-red-600 mb-4">
              ⚠️ This cannot be undone without admin intervention. All current grades will be locked.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowConfirm(false); setConfirmText('') }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button
                onClick={handleRotate}
                disabled={confirmText !== 'ROTATE' || loadingRotate}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50"
              >
                {loadingRotate ? 'Rotating…' : 'Execute Rotation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
