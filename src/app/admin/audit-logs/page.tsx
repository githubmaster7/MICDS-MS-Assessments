"use client";

import * as React from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Download,
  ScrollText,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

interface AuditLog {
  id: string;
  actor: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  ipAddress?: string;
}

const PAGE_SIZE = 25;

const ACTION_TYPES = [
  "USER_APPROVED", "USER_REJECTED", "USER_DEACTIVATED", "USER_REACTIVATED",
  "ROLE_CHANGED", "ROTATION_EXECUTED", "ROTATION_REVERTED",
  "GROUP_CREATED", "GROUP_UPDATED", "MEMBER_ADDED", "MEMBER_REMOVED",
  "SIGNIN", "SIGNOUT",
];

const TARGET_TYPES = ["USER", "SIGNUP_REQUEST", "STUDENT_GROUP", "ROTATION", "CAROUSEL_PLAN"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function ActionBadge({ action }: { action: string }) {
  const isDestructive = action.includes("REJECTED") || action.includes("DEACTIVATED") || action.includes("REMOVED") || action.includes("REVERTED");
  const isPositive = action.includes("APPROVED") || action.includes("CREATED") || action.includes("REACTIVATED") || action.includes("ADDED");
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
      isDestructive ? "bg-red-50 text-red-600 border-red-100" :
      isPositive ? "bg-green-50 text-green-700 border-green-100" :
      "bg-gray-50 text-gray-600 border-gray-200"
    }`}>
      {action.replace(/_/g, " ")}
    </span>
  );
}

function JsonView({ data }: { data: Record<string, unknown> }) {
  return (
    <pre className="text-xs bg-gray-50 border border-gray-200 rounded-md p-3 overflow-x-auto max-h-40 font-mono text-gray-700 whitespace-pre-wrap break-all">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = React.useState(false);
  const hasDetail = log.before ?? log.after ?? log.metadata;

  return (
    <>
      <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${expanded ? "bg-blue-50/40" : ""}`}>
        <td className="px-4 py-3 text-xs text-gray-500 tabular-nums whitespace-nowrap">{formatDate(log.createdAt)}</td>
        <td className="px-4 py-3">
          <p className="text-sm font-medium text-gray-900">{log.actor}</p>
          <p className="text-xs text-gray-400">{log.actorEmail}</p>
        </td>
        <td className="px-4 py-3"><ActionBadge action={log.action} /></td>
        <td className="px-4 py-3">
          <p className="text-sm text-gray-700">{log.targetLabel}</p>
          <p className="text-xs text-gray-400">{log.targetType}</p>
        </td>
        <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">{log.ipAddress ?? "—"}</td>
        <td className="px-4 py-3">
          {hasDetail && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 text-xs text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse detail" : "Expand detail"}
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRightIcon className="h-3.5 w-3.5" />}
              Detail
            </button>
          )}
        </td>
      </tr>
      {expanded && hasDetail && (
        <tr className="border-b border-gray-100 bg-blue-50/20">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {log.before && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Before</p>
                  <JsonView data={log.before} />
                </div>
              )}
              {log.after && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">After</p>
                  <JsonView data={log.after} />
                </div>
              )}
              {log.metadata && !log.before && !log.after && (
                <div className="col-span-2">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Metadata</p>
                  <JsonView data={log.metadata} />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AuditLogsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = React.useState<AuditLog[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);

  const [actorSearch, setActorSearch] = React.useState("");
  const [debouncedActor, setDebouncedActor] = React.useState("");
  const [actionType, setActionType] = React.useState("ALL");
  const [targetType, setTargetType] = React.useState("ALL");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [exporting, setExporting] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedActor(actorSearch), 300);
    return () => clearTimeout(t);
  }, [actorSearch]);

  React.useEffect(() => { setPage(1); }, [debouncedActor, actionType, targetType, dateFrom, dateTo]);

  const fetchLogs = React.useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (debouncedActor) params.set("actor", debouncedActor);
    if (actionType !== "ALL") params.set("action", actionType);
    if (targetType !== "ALL") params.set("targetType", targetType);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);

    fetch(`/api/admin/audit-logs?${params}`)
      .then((r) => r.json())
      .then((d) => { setLogs(d?.logs ?? []); setTotal(d?.total ?? 0); })
      .catch(() => { setLogs([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [page, debouncedActor, actionType, targetType, dateFrom, dateTo]);

  React.useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format: "csv", limit: "10000" });
      if (debouncedActor) params.set("actor", debouncedActor);
      if (actionType !== "ALL") params.set("action", actionType);
      if (targetType !== "ALL") params.set("targetType", targetType);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const res = await fetch(`/api/admin/audit-logs?${params}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = debouncedActor || actionType !== "ALL" || targetType !== "ALL" || dateFrom || dateTo;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Full history of administrative actions.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} loading={exporting}>
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filters</span>
          {hasFilters && (
            <button
              onClick={() => { setActorSearch(""); setActionType("ALL"); setTargetType("ALL"); setDateFrom(""); setDateTo(""); }}
              className="ml-auto text-xs text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            <Input placeholder="Actor name/email" value={actorSearch} onChange={(e) => setActorSearch(e.target.value)} className="pl-8 h-8 text-sm" aria-label="Filter by actor" />
          </div>
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger className="h-8 text-sm" aria-label="Filter by action"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All actions</SelectItem>
              {ACTION_TYPES.map((a) => <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={targetType} onValueChange={setTargetType}>
            <SelectTrigger className="h-8 text-sm" aria-label="Filter by target type"><SelectValue placeholder="Target type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All targets</SelectItem>
              {TARGET_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="space-y-0.5">
            <Label htmlFor="date-from" className="text-xs text-gray-500">From</Label>
            <Input id="date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-0.5">
            <Label htmlFor="date-to" className="text-xs text-gray-500">To</Label>
            <Input id="date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-400 tabular-nums">{total.toLocaleString()} log{total !== 1 ? "s" : ""}</div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Timestamp</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actor</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Target</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">IP Address</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide sr-only">Expand</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full max-w-[100px]" /></td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <ScrollText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">{hasFilters ? "No logs match your filters." : "No audit logs yet."}</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => <LogRow key={log.id} log={log} />)
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>{Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 tabular-nums">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
