"use client";

import * as React from "react";
import { Layers, AlertTriangle, Lock, Clock, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClassRow {
  id: string;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED" | "LOCKED";
  lockedAt: string | null;
  group: { id: string; name: string; gradeLevel: string; gender: string };
  activity: { id: string; name: string };
  teacher: { id: string; firstName: string; lastName: string };
  rotationNumber: number;
  startDate: string;
  endDate: string;
  submissionCount: number;
  assessmentCount: number;
  snapshotCount: number;
}

const STATUS_META: Record<
  ClassRow["status"],
  { label: string; className: string; icon: React.ElementType }
> = {
  UPCOMING: { label: "Upcoming", className: "bg-slate-50 text-slate-600 border-slate-200", icon: Clock },
  ACTIVE: { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-100", icon: CheckCircle2 },
  COMPLETED: { label: "Completed", className: "bg-blue-50 text-blue-700 border-blue-100", icon: CheckCircle2 },
  LOCKED: { label: "Locked", className: "bg-gray-100 text-gray-600 border-gray-200", icon: Lock },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminAllClassesPage() {
  const [status, setStatus] = React.useState("ALL");
  const [rows, setRows] = React.useState<ClassRow[]>([]);
  const [truncated, setTruncated] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchClasses = React.useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);

    fetch(`/api/admin/classes?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        setRows(d?.data ?? []);
        setTruncated(!!d?.truncated);
      })
      .catch(() => setError("Failed to load classes. Please try again."))
      .finally(() => setLoading(false));
  }, [status]);

  React.useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">All Classes</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Every scheduled class instance across every student group and teacher — current, past,
          and upcoming rotations. Read-only; grading happens on each teacher&apos;s dashboard.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36 h-8 text-sm" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="UPCOMING">Upcoming</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="LOCKED">Locked</SelectItem>
          </SelectContent>
        </Select>
        {status !== "ALL" && (
          <button
            onClick={() => setStatus("ALL")}
            className="text-xs text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
          >
            Clear filter
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400 tabular-nums">
          {rows.length.toLocaleString()} class instance{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {truncated && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Showing the first 500 matching class instances. Narrow your filters to see everyone.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rotation</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Group</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Activity</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Teacher</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dates</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Records</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full max-w-[100px]" /></td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <AlertTriangle className="h-8 w-8 text-red-300 mx-auto mb-2" />
                    <p className="text-sm text-red-500">{error}</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Layers className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No class instances match this filter.</p>
                  </td>
                </tr>
              ) : (
                rows.map((c) => {
                  const meta = STATUS_META[c.status];
                  const Icon = meta.icon;
                  return (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">#{c.rotationNumber}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{c.group.name}</p>
                        <p className="text-xs text-gray-400">
                          {c.group.gradeLevel.replace("GRADE_", "Grade ")} · {c.group.gender === "MALE" ? "Boys" : "Girls"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{c.activity.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.teacher.firstName} {c.teacher.lastName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">{fmtDate(c.startDate)} – {fmtDate(c.endDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
                          <Icon className="h-3 w-3" aria-hidden="true" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500 tabular-nums">
                        {c.snapshotCount} graded / {c.submissionCount} submitted
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
