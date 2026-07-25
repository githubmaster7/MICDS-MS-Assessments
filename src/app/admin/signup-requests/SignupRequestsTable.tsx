'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type Request = {
  id: string
  status: string
  createdAt: Date
  reviewedAt: Date | null
  reviewNotes: string | null
  user: { email: string; role: string }
}

export function SignupRequestsTable({
  requests,
  mode,
}: {
  requests: Request[]
  mode: 'pending' | 'reviewed'
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [approveModal, setApproveModal] = useState<Request | null>(null)
  const [rejectModal, setRejectModal] = useState<Request | null>(null)
  const [approveRole, setApproveRole] = useState<string>('STUDENT')
  const [rejectReason, setRejectReason] = useState('')

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        {mode === 'pending' ? 'No pending requests.' : 'No reviewed requests yet.'}
      </div>
    )
  }

  async function handleApprove(reqId: string, role: string) {
    setLoading(reqId)
    try {
      const res = await fetch(`/api/admin/signup-requests/${reqId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) throw new Error(await res.text())
      setApproveModal(null)
      router.refresh()
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setLoading(null)
    }
  }

  async function handleReject(reqId: string, reason: string) {
    if (!reason.trim()) { alert('Reason is required.'); return }
    setLoading(reqId)
    try {
      const res = await fetch(`/api/admin/signup-requests/${reqId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error(await res.text())
      setRejectModal(null)
      setRejectReason('')
      router.refresh()
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setLoading(null)
    }
  }

  const statusBadge: Record<string, string> = {
    PENDING: 'bg-warning-100 text-warning-800',
    APPROVED: 'bg-success-100 text-success-800',
    REJECTED: 'bg-danger-100 text-danger-800',
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-primary-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-primary-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Role Requested</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              {mode === 'pending' && <th className="px-4 py-3 text-right font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{r.user.email}</td>
                <td className="px-4 py-3 text-gray-600">{r.user.role}</td>
                <td className="px-4 py-3 text-gray-500">
                  {r.createdAt.toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[r.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {r.status}
                  </span>
                  {r.reviewNotes && (
                    <span className="ml-2 text-gray-400 text-xs">— {r.reviewNotes}</span>
                  )}
                </td>
                {mode === 'pending' && (
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => { setApproveModal(r); setApproveRole('STUDENT') }}
                      disabled={loading === r.id}
                      className="mr-2"
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { setRejectModal(r); setRejectReason('') }}
                      disabled={loading === r.id}
                    >
                      Reject
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Approve Modal */}
      {approveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold mb-1">Approve Account</h3>
            <p className="text-sm text-gray-500 mb-4">{approveModal.user.email}</p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign Role</label>
            <select
              value={approveRole}
              onChange={(e) => setApproveRole(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="STUDENT">Student</option>
              <option value="TEACHER">Teacher</option>
              <option value="PARENT">Parent</option>
            </select>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setApproveModal(null)}>Cancel</Button>
              <Button
                variant="success"
                onClick={() => handleApprove(approveModal.id, approveRole)}
                loading={loading === approveModal.id}
              >
                {loading === approveModal.id ? 'Approving…' : 'Confirm Approval'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold mb-1">Reject Account Request</h3>
            <p className="text-sm text-gray-500 mb-4">{rejectModal.user.email}</p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (required)</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Explain why this request is being rejected…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setRejectModal(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => handleReject(rejectModal.id, rejectReason)}
                disabled={!rejectReason.trim()}
                loading={loading === rejectModal.id}
              >
                {loading === rejectModal.id ? 'Rejecting…' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
