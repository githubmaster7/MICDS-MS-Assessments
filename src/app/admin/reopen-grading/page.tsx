"use client";

import * as React from "react";
import { Unlock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";

interface Candidate {
  groupId: string;
  groupName: string;
  instanceId: string;
  rotationNumber: number;
  activityName: string;
  lockedAt: string | null;
  teacher: { id: string; name: string };
  students: { id: string; name: string }[];
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ReopenGradingPage() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [selectedGroups, setSelectedGroups] = React.useState<Set<string>>(new Set());
  const [selectedTeachers, setSelectedTeachers] = React.useState<Set<string>>(new Set());
  const [selectedStudents, setSelectedStudents] = React.useState<Set<string>>(new Set());
  const [reason, setReason] = React.useState("");
  const [confirmText, setConfirmText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<{ message: string } | null>(null);

  const fetchCandidates = React.useCallback(() => {
    setLoading(true);
    fetch("/api/admin/regrade-grants/reopen-candidates")
      .then((r) => r.json())
      .then((d) => setCandidates(d?.data ?? []))
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Teachers/students shown are scoped to whichever groups are currently
  // checked — but selecting a group never auto-checks its teacher/students;
  // each column's own selection state is independent.
  const scopedCandidates = candidates.filter((c) => selectedGroups.has(c.groupId));
  const scopedTeachers = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of scopedCandidates) map.set(c.teacher.id, c.teacher.name);
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [scopedCandidates]);
  const scopedStudents = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of scopedCandidates) for (const s of c.students) map.set(s.id, s.name);
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [scopedCandidates]);

  // Dropping a group out of selection also drops any now-out-of-scope
  // teacher/student picks, so "reopen for these groups" can't silently keep
  // a stale teacher/student from a group that's no longer checked.
  React.useEffect(() => {
    const validTeacherIds = new Set(scopedTeachers.map((t) => t.id));
    setSelectedTeachers((prev) => new Set([...prev].filter((id) => validTeacherIds.has(id))));
    const validStudentIds = new Set(scopedStudents.map((s) => s.id));
    setSelectedStudents((prev) => new Set([...prev].filter((id) => validStudentIds.has(id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroups]);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  const allGroupsSelected = candidates.length > 0 && selectedGroups.size === candidates.length;
  const allTeachersSelected = scopedTeachers.length > 0 && scopedTeachers.every((t) => selectedTeachers.has(t.id));
  const allStudentsSelected = scopedStudents.length > 0 && scopedStudents.every((s) => selectedStudents.has(s.id));

  const canSubmit =
    selectedGroups.size > 0 &&
    (selectedTeachers.size > 0 || selectedStudents.size > 0) &&
    reason.trim() !== "" &&
    confirmText === "REOPEN";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/regrade-grants/bulk-select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupIds: [...selectedGroups],
          teacherProfileIds: [...selectedTeachers],
          studentProfileIds: [...selectedStudents],
          reason: reason.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to reopen grading.");
      setResult({ message: data?.data?.message ?? "Done." });
      toast({ title: data?.data?.message ?? "Grading reopened" });
      setSelectedGroups(new Set());
      setSelectedTeachers(new Set());
      setSelectedStudents(new Set());
      setReason("");
      setConfirmText("");
      fetchCandidates();
    } catch (e) {
      toast({ title: "Failed to reopen grading", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Unlock className="h-5 w-5 text-amber-600" aria-hidden="true" />
          Reopen Historical Grading
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Pick Groups, Teachers, and Students independently — checking one never auto-selects the others.
          Each selected group's most-recently-locked class is reopened for teacher regrading (if its teacher
          is selected) and/or student resubmission (for whichever of its current students are selected).
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-80 w-full rounded-xl" />)}
        </div>
      ) : candidates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
          <p className="text-sm text-gray-400">No locked class history available to reopen.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Groups column */}
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Groups</span>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <Checkbox
                  checked={allGroupsSelected}
                  onCheckedChange={(v) =>
                    setSelectedGroups(v === true ? new Set(candidates.map((c) => c.groupId)) : new Set())
                  }
                />
                Select All Groups
              </label>
            </div>
            <div className="flex-1 overflow-y-auto max-h-96 divide-y divide-gray-100">
              {candidates.map((c) => (
                <label key={c.groupId} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                  <Checkbox
                    checked={selectedGroups.has(c.groupId)}
                    onCheckedChange={() => toggle(selectedGroups, setSelectedGroups, c.groupId)}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.groupName}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {c.activityName} · Rotation {c.rotationNumber} · Locked {formatDate(c.lockedAt)}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Teachers column */}
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Teachers</span>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <Checkbox
                  checked={allTeachersSelected}
                  disabled={scopedTeachers.length === 0}
                  onCheckedChange={(v) =>
                    setSelectedTeachers(v === true ? new Set(scopedTeachers.map((t) => t.id)) : new Set())
                  }
                />
                Select All Teachers
              </label>
            </div>
            <p className="px-3 pt-2 text-[11px] text-gray-400">Only for selected groups</p>
            <div className="flex-1 overflow-y-auto max-h-96 divide-y divide-gray-100">
              {scopedTeachers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8 px-3">Check a group to see its teacher.</p>
              ) : (
                scopedTeachers.map((t) => (
                  <label key={t.id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                    <Checkbox
                      checked={selectedTeachers.has(t.id)}
                      onCheckedChange={() => toggle(selectedTeachers, setSelectedTeachers, t.id)}
                    />
                    <span className="text-sm text-gray-900 truncate">{t.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Students column */}
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Students</span>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <Checkbox
                  checked={allStudentsSelected}
                  disabled={scopedStudents.length === 0}
                  onCheckedChange={(v) =>
                    setSelectedStudents(v === true ? new Set(scopedStudents.map((s) => s.id)) : new Set())
                  }
                />
                Select All Students
              </label>
            </div>
            <p className="px-3 pt-2 text-[11px] text-gray-400">Only for selected groups</p>
            <div className="flex-1 overflow-y-auto max-h-96 divide-y divide-gray-100">
              {scopedStudents.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8 px-3">Check a group to see its students.</p>
              ) : (
                scopedStudents.map((s) => (
                  <label key={s.id} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                    <Checkbox
                      checked={selectedStudents.has(s.id)}
                      onCheckedChange={() => toggle(selectedStudents, setSelectedStudents, s.id)}
                    />
                    <span className="text-sm text-gray-900 truncate">{s.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reopen-reason">Reason</Label>
          <Textarea
            id="reopen-reason"
            placeholder="Why is this being reopened?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reopen-confirm">
            Type <strong className="font-mono tracking-wider">REOPEN</strong> to confirm
          </Label>
          <Input
            id="reopen-confirm"
            placeholder="REOPEN"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="font-mono max-w-xs"
            autoComplete="off"
          />
        </div>
        {result && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            {result.message}
          </p>
        )}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {selectedGroups.size} group{selectedGroups.size !== 1 ? "s" : ""} · {selectedTeachers.size} teacher
            {selectedTeachers.size !== 1 ? "s" : ""} · {selectedStudents.size} student
            {selectedStudents.size !== 1 ? "s" : ""} selected
          </p>
          <Button variant="destructive" onClick={handleSubmit} disabled={!canSubmit} loading={submitting}>
            <Unlock className="h-4 w-4" aria-hidden="true" />
            Reopen selected
          </Button>
        </div>
      </div>
    </div>
  );
}
