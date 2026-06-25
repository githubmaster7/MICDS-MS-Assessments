"use client";

import * as React from "react";
import {
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  AlertTriangle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { ROLES } from "@/lib/constants";

interface SignupRequest {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  reviewNote?: string;
  reviewedAt?: string;
  reviewedByName?: string;
}

const ROLE_LABELS: Record<string, string> = {
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
  ADMIN: "Admin",
};

const PAGE_SIZE = 20;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    TEACHER: "bg-blue-50 text-blue-700 border-blue-100",
    STUDENT: "bg-green-50 text-green-700 border-green-100",
    PARENT: "bg-purple-50 text-purple-700 border-purple-100",
    ADMIN: "bg-red-50 text-red-700 border-red-100",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[role] ?? "bg-gray-50 text-gray-700 border-gray-200"}`}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function RequestRow({
  req,
  onApprove,
  onReject,
  actionable,
}: {
  req: SignupRequest;
  onApprove: (r: SignupRequest) => void;
  onReject: (r: SignupRequest) => void;
  actionable: boolean;
}) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900">{req.name}</p>
        <p className="text-xs text-gray-500">{req.email}</p>
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={req.role} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
        {formatDate(req.createdAt)}
      </td>
      {!actionable && (
        <td className="px-4 py-3">
          {req.status === "APPROVED" ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
              <XCircle className="h-3.5 w-3.5" />
              Rejected
            </span>
          )}
        </td>
      )}
      {!actionable && (
        <td className="px-4 py-3 text-xs text-gray-400">
          {req.reviewedByName ?? "—"}
          {req.reviewedAt ? ` · ${formatDate(req.reviewedAt)}` : ""}
          {req.reviewNote && (
            <p className="text-gray-500 italic mt-0.5 max-w-xs truncate">
              &ldquo;{req.reviewNote}&rdquo;
            </p>
          )}
        </td>
      )}
      {actionable && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="success"
              onClick={() => onApprove(req)}
              aria-label={`Approve ${req.name}`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => onReject(req)}
              aria-label={`Reject ${req.name}`}
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Reject
            </Button>
          </div>
        </td>
      )}
    </tr>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <tr>
      <td colSpan={99} className="py-16 text-center">
        <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">{message}</p>
      </td>
    </tr>
  );
}

export default function SignupRequestsPage() {
  const { toast } = useToast();
  const [tab, setTab] = React.useState("PENDING");
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [requests, setRequests] = React.useState<SignupRequest[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const [approveTarget, setApproveTarget] =
    React.useState<SignupRequest | null>(null);
  const [approveRole, setApproveRole] = React.useState("");
  const [approveNote, setApproveNote] = React.useState("");
  const [approveLoading, setApproveLoading] = React.useState(false);

  const [rejectTarget, setRejectTarget] = React.useState<SignupRequest | null>(
    null
  );
  const [rejectReason, setRejectReason] = React.useState("");
  const [rejectLoading, setRejectLoading] = React.useState(false);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      status: tab,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (search) params.set("search", search);

    fetch(`/api/admin/signup-requests?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setRequests(d?.requests ?? []);
        setTotal(d?.total ?? 0);
      })
      .catch(() => {
        setRequests([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [tab, page, search]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  React.useEffect(() => {
    setPage(1);
  }, [tab, search]);

  const handleApprove = async () => {
    if (!approveTarget) return;
    setApproveLoading(true);
    try {
      const res = await fetch(
        `/api/admin/signup-requests/${approveTarget.id}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: approveRole || approveTarget.role,
            note: approveNote || undefined,
          }),
        }
      );
      if (!res.ok) throw new Error();
      toast({
        title: "Request approved",
        description: `${approveTarget.name} approved as ${ROLE_LABELS[approveRole || approveTarget.role]}.`,
      });
      setApproveTarget(null);
      setApproveNote("");
      setApproveRole("");
      fetchData();
    } catch {
      toast({ title: "Failed to approve", variant: "destructive" });
    } finally {
      setApproveLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setRejectLoading(true);
    try {
      const res = await fetch(
        `/api/admin/signup-requests/${rejectTarget.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: rejectReason.trim() }),
        }
      );
      if (!res.ok) throw new Error();
      toast({
        title: "Request rejected",
        description: `${rejectTarget.name}'s request has been rejected.`,
      });
      setRejectTarget(null);
      setRejectReason("");
      fetchData();
    } catch {
      toast({ title: "Failed to reject", variant: "destructive" });
    } finally {
      setRejectLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Signup Requests</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Review and manage account requests from students, teachers, and parents.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v)}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="PENDING">Pending</TabsTrigger>
            <TabsTrigger value="APPROVED">Approved</TabsTrigger>
            <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
          </TabsList>

          <div className="relative w-56">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400"
              aria-hidden="true"
            />
            <Input
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
              aria-label="Search requests"
            />
          </div>
        </div>

        {(["PENDING", "APPROVED", "REJECTED"] as const).map((status) => (
          <TabsContent key={status} value={status} className="mt-4">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[560px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Name / Email
                      </th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Role
                      </th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Requested
                      </th>
                      {status !== "PENDING" && (
                        <>
                          <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Status
                          </th>
                          <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Reviewed by
                          </th>
                        </>
                      )}
                      {status === "PENDING" && (
                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          {Array.from({
                            length: status === "PENDING" ? 4 : 5,
                          }).map((_, j) => (
                            <td key={j} className="px-4 py-3">
                              <Skeleton className="h-4 w-full max-w-[120px]" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : requests.length === 0 ? (
                      <EmptyState
                        message={
                          search
                            ? "No results match your search."
                            : status === "PENDING"
                            ? "No pending requests."
                            : status === "APPROVED"
                            ? "No approved requests yet."
                            : "No rejected requests."
                        }
                      />
                    ) : (
                      requests.map((req) => (
                        <RequestRow
                          key={req.id}
                          req={req}
                          onApprove={setApproveTarget}
                          onReject={setRejectTarget}
                          actionable={status === "PENDING"}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
                  <span>
                    {Math.min((page - 1) * PAGE_SIZE + 1, total)}–
                    {Math.min(page * PAGE_SIZE, total)} of {total}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page <= 1}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 tabular-nums">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Approve Modal */}
      <Dialog
        open={!!approveTarget}
        onOpenChange={(o) => !o && setApproveTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve signup request</DialogTitle>
          </DialogHeader>
          {approveTarget && (
            <div className="space-y-4 py-2">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-gray-900">{approveTarget.name}</p>
                <p className="text-gray-500">{approveTarget.email}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="approve-role">Role</Label>
                <Select
                  value={approveRole || approveTarget.role}
                  onValueChange={setApproveRole}
                >
                  <SelectTrigger id="approve-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ROLES.TEACHER}>Teacher</SelectItem>
                    <SelectItem value={ROLES.STUDENT}>Student</SelectItem>
                    <SelectItem value={ROLES.PARENT}>Parent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="approve-note">
                  Note{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="approve-note"
                  placeholder="Any note for the user…"
                  value={approveNote}
                  onChange={(e) => setApproveNote(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveTarget(null)}
              disabled={approveLoading}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={handleApprove}
              loading={approveLoading}
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => !o && setRejectTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />
              Reject signup request
            </DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-4 py-2">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-medium text-gray-900">{rejectTarget.name}</p>
                <p className="text-gray-500">{rejectTarget.email}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reject-reason">
                  Reason{" "}
                  <span className="text-red-500 text-xs font-normal">
                    (required)
                  </span>
                </Label>
                <Textarea
                  id="reject-reason"
                  placeholder="Explain why this request is being rejected…"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectTarget(null)}
              disabled={rejectLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim()}
              loading={rejectLoading}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
