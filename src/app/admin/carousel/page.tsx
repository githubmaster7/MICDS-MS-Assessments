"use client";

import * as React from "react";
import {
  RotateCcw,
  Eye,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Clock,
  Undo2,
  CalendarDays,
  Save,
  Plus,
  X,
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
import { useToast } from "@/components/ui/use-toast";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";

interface Position {
  id: string;
  positionOrder: number;
  teacherName: string;
  activity: string;
  isCurrent: boolean;
}

interface GroupCarousel {
  id: string;
  name: string;
  gradeLevel: string;
  gender: string;
  positions: Position[];
}

interface RotationRecord {
  id: string;
  studentGroupId: string;
  groupName: string;
  rotationNumber: number;
  fromActivityName: string | null;
  toActivityName: string;
  executedAt: string;
  executedByEmail: string;
  isReverted: boolean;
  revertedByEmail: string | null;
  revertReason: string | null;
}

interface GroupPreviewRow {
  studentGroupId: string;
  groupName: string;
  currentActivity: string | null;
  currentTeacher: string | null;
  nextActivity: string | null;
  nextTeacher: string | null;
  earlyRotation: { currentEndDate: string } | null;
  error?: string;
}

interface EarlyRotationInfo {
  groups: Array<{ studentGroupId: string; groupName: string; currentEndDate: string }>;
}

interface AssignmentOption {
  id: string;
  teacherProfile: { firstName: string; lastName: string };
  activityTemplate: { name: string };
}

const GRADE_LABELS: Record<string, string> = { GRADE_5: "5", GRADE_6: "6", GRADE_7: "7", GRADE_8: "8" };
const GENDER_LABELS: Record<string, string> = { MALE: "Boys", FEMALE: "Girls" };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function defaultDates() {
  const today = new Date();
  const twoWeeksOut = new Date(today);
  twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
  return { start: toInputDate(today), end: toInputDate(twoWeeksOut) };
}

function GenderDot({ gender }: { gender: string }) {
  const colors: Record<string, string> = { MALE: "bg-blue-400", FEMALE: "bg-pink-400" };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[gender] ?? "bg-gray-400"}`} title={GENDER_LABELS[gender] ?? gender} />;
}

export default function CarouselPage() {
  const { toast } = useToast();

  const [planId, setPlanId] = React.useState<string | null>(null);
  const [planName, setPlanName] = React.useState("");
  const [groups, setGroups] = React.useState<GroupCarousel[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dirtyGroups, setDirtyGroups] = React.useState<Set<string>>(new Set());
  const [savingGroupId, setSavingGroupId] = React.useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<Set<string>>(new Set());

  const [history, setHistory] = React.useState<RotationRecord[]>([]);

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewRows, setPreviewRows] = React.useState<GroupPreviewRow[]>([]);

  const [fullPlanOpen, setFullPlanOpen] = React.useState(false);
  const [fullPlan, setFullPlan] = React.useState<Array<{ groupId: string; groupName: string; steps: Array<{ rotationNumber: number; status: string; teacher: string; activity: string }> }>>([]);
  const [fullPlanLoading, setFullPlanLoading] = React.useState(false);
  const [fullPlanError, setFullPlanError] = React.useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmGroupIds, setConfirmGroupIds] = React.useState<string[]>([]);
  const [confirmText, setConfirmText] = React.useState("");
  const [rotating, setRotating] = React.useState(false);
  const [rotateStartDate, setRotateStartDate] = React.useState("");
  const [rotateEndDate, setRotateEndDate] = React.useState("");
  const [earlyRotation, setEarlyRotation] = React.useState<EarlyRotationInfo | null>(null);
  const [earlyRotationChecking, setEarlyRotationChecking] = React.useState(false);
  const [overrideEarlyRotation, setOverrideEarlyRotation] = React.useState(false);

  const [setupGroup, setSetupGroup] = React.useState<{ id: string; name: string } | null>(null);
  const [setupOptions, setSetupOptions] = React.useState<AssignmentOption[]>([]);
  const [setupOptionsLoading, setSetupOptionsLoading] = React.useState(false);
  const [setupSelected, setSetupSelected] = React.useState<string[]>([]);
  const [setupStartDate, setSetupStartDate] = React.useState("");
  const [setupEndDate, setSetupEndDate] = React.useState("");
  const [setupSubmitting, setSetupSubmitting] = React.useState(false);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    fetch("/api/admin/carousel")
      .then((r) => r.json())
      .then(async (carouselData) => {
        interface RawPlan { id: string; name: string; isActive: boolean }
        const plans: RawPlan[] = carouselData?.data ?? [];
        const plan = plans.find((p) => p.isActive) ?? plans[0] ?? null;
        if (!plan) {
          setPlanId(null);
          setPlanName("");
          setGroups([]);
          setHistory([]);
          return;
        }
        setPlanId(plan.id);
        setPlanName(plan.name);

        const groupsRes = await fetch("/api/admin/student-groups");
        const groupsData = await groupsRes.json();
        interface RawGroup { id: string; name: string; gradeLevel: string; gender: string; isActive: boolean }
        const activeGroups: RawGroup[] = (groupsData?.data ?? []).filter((g: RawGroup) => g.isActive);

        interface RawPosition {
          id: string;
          positionOrder: number;
          teacherClassAssignment: { teacherProfile: { firstName: string; lastName: string }; activityTemplate: { name: string } };
          groupRotationAssignments: Array<{ id: string }>;
        }

        const groupCarousels: GroupCarousel[] = await Promise.all(
          activeGroups.map(async (g) => {
            const posRes = await fetch(`/api/admin/carousel/${g.id}/positions`);
            const posData = await posRes.json();
            const rawPositions: RawPosition[] = posData?.data ?? [];
            const positions: Position[] = rawPositions
              .map((p) => ({
                id: p.id,
                positionOrder: p.positionOrder,
                teacherName: `${p.teacherClassAssignment.teacherProfile.firstName} ${p.teacherClassAssignment.teacherProfile.lastName}`,
                activity: p.teacherClassAssignment.activityTemplate.name,
                isCurrent: p.groupRotationAssignments.length > 0,
              }))
              .sort((a, b) => a.positionOrder - b.positionOrder);
            return { id: g.id, name: g.name, gradeLevel: g.gradeLevel, gender: g.gender, positions };
          }),
        );
        setGroups(groupCarousels);
        setSelectedGroupIds((prev) => (prev.size > 0 ? prev : new Set(groupCarousels.map((g) => g.id))));

        const historyRes = await fetch(`/api/admin/carousel/rotation-history?planId=${plan.id}`);
        const historyData = await historyRes.json();
        setHistory(historyData?.data ?? []);
      })
      .catch(() => { setGroups([]); setHistory([]); })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const toggleGroupSelected = (groupId: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  };

  const movePosition = (groupId: string, index: number, direction: -1 | 1) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        const target = index + direction;
        if (target < 0 || target >= g.positions.length) return g;
        const positions = [...g.positions];
        [positions[index], positions[target]] = [positions[target], positions[index]];
        return { ...g, positions: positions.map((p, i) => ({ ...p, positionOrder: i + 1 })) };
      }),
    );
    setDirtyGroups((prev) => new Set(prev).add(groupId));
  };

  const saveOrder = async (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setSavingGroupId(groupId);
    try {
      const res = await fetch(`/api/admin/carousel/${groupId}/positions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions: group.positions.map((p) => ({ positionId: p.id, positionOrder: p.positionOrder })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to save order.");
      toast({ title: `${group.name}: order saved` });
      setDirtyGroups((prev) => { const next = new Set(prev); next.delete(groupId); return next; });
      fetchData();
    } catch (e) {
      toast({ title: "Failed to save order", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSavingGroupId(null);
    }
  };

  const handlePreview = async (groupIds: string[]) => {
    if (!planId) return;
    if (groupIds.length === 0) {
      toast({ title: "Select at least one group to preview", variant: "destructive" });
      return;
    }
    setPreviewLoading(true);
    setPreviewOpen(true);
    const { start, end } = defaultDates();
    try {
      const res = await fetch("/api/admin/carousel/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, studentGroupIds: groupIds, confirm: false, startDate: new Date(start).toISOString(), endDate: new Date(end).toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to load preview.");
      setPreviewRows(data?.data?.groups ?? []);
    } catch (e) {
      setPreviewRows([]);
      toast({ title: "Failed to load preview", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleViewFullPlan = async () => {
    if (!planId) return;
    setFullPlanOpen(true);
    setFullPlanLoading(true);
    setFullPlanError(null);
    try {
      const res = await fetch(`/api/admin/carousel/full-plan?planId=${planId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load the full plan.");
      setFullPlan(data?.data ?? []);
    } catch (e) {
      setFullPlan([]);
      setFullPlanError(e instanceof Error ? e.message : "Failed to load the full plan.");
    } finally {
      setFullPlanLoading(false);
    }
  };

  const checkEarlyRotation = React.useCallback(async (groupIds: string[], startDateInput: string) => {
    if (!planId || groupIds.length === 0 || !startDateInput) return;
    setEarlyRotationChecking(true);
    try {
      const placeholderEnd = new Date(startDateInput);
      placeholderEnd.setDate(placeholderEnd.getDate() + 1);
      const res = await fetch("/api/admin/carousel/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, studentGroupIds: groupIds, confirm: false, startDate: new Date(startDateInput).toISOString(), endDate: placeholderEnd.toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      const rows: GroupPreviewRow[] = data?.data?.groups ?? [];
      const early = rows.filter((r) => r.earlyRotation);
      setEarlyRotation(
        early.length > 0
          ? { groups: early.map((r) => ({ studentGroupId: r.studentGroupId, groupName: r.groupName, currentEndDate: r.earlyRotation!.currentEndDate })) }
          : null,
      );
    } catch {
      setEarlyRotation(null);
    } finally {
      setEarlyRotationChecking(false);
    }
  }, [planId]);

  const openConfirmRotate = (groupIds: string[]) => {
    if (groupIds.length === 0) {
      toast({ title: "Select at least one group to rotate", variant: "destructive" });
      return;
    }
    const { start, end } = defaultDates();
    setConfirmGroupIds(groupIds);
    setRotateStartDate(start);
    setRotateEndDate(end);
    setOverrideEarlyRotation(false);
    setEarlyRotation(null);
    setConfirmText("");
    setConfirmOpen(true);
    checkEarlyRotation(groupIds, start);
  };

  const handleRotate = async () => {
    if (!planId || confirmText !== "ROTATE" || !rotateStartDate || !rotateEndDate) return;
    if (earlyRotation && !overrideEarlyRotation) return;
    setRotating(true);
    try {
      const res = await fetch("/api/admin/carousel/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          studentGroupIds: confirmGroupIds,
          confirm: true,
          override: overrideEarlyRotation,
          startDate: new Date(rotateStartDate).toISOString(),
          endDate: new Date(rotateEndDate).toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data?.earlyRotation) {
        setEarlyRotation(data.earlyRotation);
        toast({ title: "Confirm overriding the current rotation's end date first", variant: "destructive" });
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? "Rotation failed.");
      const rotatedCount = data?.data?.rotated?.length ?? 0;
      toast({ title: `${rotatedCount} group${rotatedCount !== 1 ? "s" : ""} rotated`, description: "All groups have been assigned to their new positions." });
      setConfirmOpen(false);
      setConfirmText("");
      setPreviewOpen(false);
      fetchData();
    } catch (e) {
      toast({ title: "Rotation failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setRotating(false);
    }
  };

  const openSetupDialog = async (group: { id: string; name: string }) => {
    setSetupGroup(group);
    setSetupSelected([]);
    const { start, end } = defaultDates();
    setSetupStartDate(start);
    setSetupEndDate(end);
    setSetupOptionsLoading(true);
    try {
      const res = await fetch("/api/admin/teacher-class-assignments?isActive=true");
      const data = await res.json().catch(() => ({}));
      setSetupOptions(data?.data ?? []);
    } catch {
      setSetupOptions([]);
    } finally {
      setSetupOptionsLoading(false);
    }
  };

  const toggleSetupSelection = (id: string) => {
    setSetupSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleCreatePositions = async () => {
    if (!setupGroup || !planId || setupSelected.length === 0 || !setupStartDate || !setupEndDate) return;
    setSetupSubmitting(true);
    try {
      const res = await fetch(`/api/admin/carousel/${setupGroup.id}/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          teacherClassAssignmentIds: setupSelected,
          startDate: new Date(setupStartDate).toISOString(),
          endDate: new Date(setupEndDate).toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to set up rotation.");
      toast({ title: `${setupGroup.name}: rotation set up`, description: `${setupSelected.length} position${setupSelected.length !== 1 ? "s" : ""} created.` });
      setSetupGroup(null);
      fetchData();
    } catch (e) {
      toast({ title: "Failed to set up rotation", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setSetupSubmitting(false);
    }
  };

  const allGroupIds = groups.map((g) => g.id);
  const selectedList = Array.from(selectedGroupIds);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Carousel & Rotations"
        description={planName || "Loading carousel plan…"}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={handleViewFullPlan} disabled={!planId}>
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              View full plan
            </Button>
            <Button variant="outline" onClick={() => handlePreview(selectedList)} disabled={!planId || selectedList.length === 0}>
              <Eye className="h-4 w-4" aria-hidden="true" />
              Preview selected
            </Button>
            <Button variant="outline" onClick={() => openConfirmRotate(selectedList)} disabled={!planId || selectedList.length === 0}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Rotate selected
            </Button>
            <Button variant="outline" onClick={() => openConfirmRotate(allGroupIds)} disabled={!planId || allGroupIds.length === 0}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Rotate all
            </Button>
          </div>
        }
      />

      {/* Per-group carousel positions */}
      <section aria-labelledby="positions-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="positions-heading" className="text-sm font-semibold text-gray-700">Carousel Positions</h2>
          <p className="text-xs text-gray-400">Each group has its own independent rotation order - check the groups you want to include in a rotation.</p>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
            <RotateCcw className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No active student groups configured.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {groups.map((group) => (
              <div key={group.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.has(group.id)}
                    onChange={() => toggleGroupSelected(group.id)}
                    className="rounded border-gray-300"
                    aria-label={`Include ${group.name} in next rotation`}
                  />
                  <GenderDot gender={group.gender} />
                  <h3 className="text-sm font-semibold text-gray-900 flex-1 truncate">{group.name}</h3>
                  <span className="text-xs text-gray-400">Gr.{GRADE_LABELS[group.gradeLevel] ?? group.gradeLevel}</span>
                  {dirtyGroups.has(group.id) && (
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => saveOrder(group.id)} loading={savingGroupId === group.id}>
                      <Save className="h-3 w-3" aria-hidden="true" />
                      Save order
                    </Button>
                  )}
                </div>
                {group.positions.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 py-6 text-center">
                    <p className="text-xs text-gray-400 mb-2">No carousel positions configured yet.</p>
                    <Button size="sm" variant="outline" onClick={() => openSetupDialog({ id: group.id, name: group.name })}>
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      Set up rotation
                    </Button>
                  </div>
                ) : (
                <div className="space-y-1.5" role="list" aria-label={`${group.name} carousel positions`}>
                  {group.positions.map((position, index) => (
                    <div
                      key={position.id}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${position.isCurrent ? "bg-emerald-50 border-emerald-200" : "bg-white border-gray-100"}`}
                      role="listitem"
                    >
                      <span className="text-xs font-semibold text-gray-400 tabular-nums w-4 shrink-0">{position.positionOrder}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{position.activity}</p>
                        <p className="text-xs text-gray-500 truncate">{position.teacherName}</p>
                      </div>
                      {position.isCurrent && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 rounded-full px-1.5 py-0.5 shrink-0">Now</span>
                      )}
                      <div className="flex flex-col gap-0 shrink-0">
                        <button
                          onClick={() => movePosition(group.id, index, -1)}
                          disabled={index === 0}
                          className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                          aria-label="Move position up"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => movePosition(group.id, index, 1)}
                          disabled={index === group.positions.length - 1}
                          className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                          aria-label="Move position down"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* History */}
      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-sm font-semibold text-gray-700 mb-3">Rotation History</h2>
        <div className="bg-white rounded-xl border border-primary-200 overflow-hidden">
          {history.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="h-7 w-7 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No rotations yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[680px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-primary-50">
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Group</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Change</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Executed by</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-700 tabular-nums whitespace-nowrap">{formatDateTime(r.executedAt)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.groupName}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {r.fromActivityName ? `${r.fromActivityName} → ${r.toActivityName}` : `Started on ${r.toActivityName}`}
                        <span className="text-xs text-gray-400 ml-1.5">(Rotation {r.rotationNumber})</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.executedByEmail}</td>
                      <td className="px-4 py-3">
                        {r.isReverted ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                            <Undo2 className="h-3 w-3" />Reverted
                          </span>
                        ) : (
                          <span className="text-xs text-green-700 font-medium">Complete</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Full plan modal */}
      <Dialog open={fullPlanOpen} onOpenChange={(o) => !o && setFullPlanOpen(false)}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>Full carousel plan</DialogTitle></DialogHeader>
          <p className="text-xs text-gray-500 -mt-2">
            Every group&apos;s scheduled teacher/activity for each rotation this school year -
            already-completed rotations aren&apos;t shown, only the current and upcoming ones.
          </p>
          <div className="flex-1 overflow-auto">
            {fullPlanLoading ? (
              <div className="space-y-2 py-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : fullPlanError ? (
              <div className="py-8 text-center">
                <AlertTriangle className="h-7 w-7 text-red-300 mx-auto mb-2" />
                <p className="text-sm text-red-500">{fullPlanError}</p>
              </div>
            ) : fullPlan.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No scheduled rotations to show.</div>
            ) : (
              (() => {
                const rotationNumbers = [...new Set(fullPlan.flatMap((row) => row.steps.map((s) => s.rotationNumber)))].sort((a, b) => a - b);
                return (
                  <table className="w-full text-sm border-separate border-spacing-0 min-w-[640px]">
                    <thead>
                      <tr>
                        <th className="sticky left-0 bg-white px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200">
                          Group
                        </th>
                        {rotationNumbers.map((n) => (
                          <th key={n} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200 whitespace-nowrap">
                            Rotation {n}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fullPlan.map((row) => {
                        const stepByRotation = new Map(row.steps.map((s) => [s.rotationNumber, s]));
                        return (
                          <tr key={row.groupId} className="hover:bg-gray-50">
                            <td className="sticky left-0 bg-white px-3 py-2.5 font-medium text-gray-900 border-b border-gray-100 whitespace-nowrap">
                              {row.groupName}
                            </td>
                            {rotationNumbers.map((n) => {
                              const s = stepByRotation.get(n);
                              return (
                                <td key={n} className="px-3 py-2.5 border-b border-gray-100 whitespace-nowrap">
                                  {s ? (
                                    <>
                                      <span className={`block ${s.status === "ACTIVE" ? "text-emerald-700 font-medium" : "text-gray-800"}`}>
                                        {s.activity}
                                      </span>
                                      <span className="block text-xs text-gray-400">{s.teacher}</span>
                                    </>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFullPlanOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview modal */}
      <Dialog open={previewOpen} onOpenChange={(o) => !o && setPreviewOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>Preview next rotation</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {previewLoading ? (
              <div className="space-y-2 py-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : previewRows.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No groups to preview.</div>
            ) : (
              <div className="overflow-x-auto border border-primary-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-gray-200 bg-primary-50">
                      <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">Group</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">Current</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">Next</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.map((row) => (
                      <tr key={row.studentGroupId} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-medium text-gray-900">{row.groupName}</td>
                        {row.error ? (
                          <td className="px-3 py-2.5 text-red-500 text-xs" colSpan={2}>{row.error}</td>
                        ) : (
                          <>
                            <td className="px-3 py-2.5 text-gray-600">
                              <span className="block">{row.currentTeacher ?? "-"}</span>
                              <span className="text-xs text-gray-400">{row.currentActivity ?? "Not yet started"}</span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-800">
                              <span className="block font-medium">{row.nextTeacher}</span>
                              <span className="text-xs text-gray-500">{row.nextActivity}</span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
            <Button onClick={() => { setPreviewOpen(false); openConfirmRotate(previewRows.filter((r) => !r.error).map((r) => r.studentGroupId)); }}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Confirm rotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm rotate modal */}
      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!o) { setConfirmOpen(false); setConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />
              Confirm class rotation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-gray-600">
              This will advance the following group{confirmGroupIds.length !== 1 ? "s" : ""} to their next carousel position - each group's own rotation order, independent of the others. This action is logged.
              <ul className="list-disc list-inside mt-1.5 text-gray-700">
                {confirmGroupIds.map((gid) => {
                  const g = groups.find((gr) => gr.id === gid);
                  return <li key={gid}>{g?.name ?? gid}</li>;
                })}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rotate-start-date">New rotation starts</Label>
                <Input
                  id="rotate-start-date"
                  type="date"
                  value={rotateStartDate}
                  onChange={(e) => {
                    setRotateStartDate(e.target.value);
                    setOverrideEarlyRotation(false);
                    checkEarlyRotation(confirmGroupIds, e.target.value);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rotate-end-date">New rotation ends</Label>
                <Input id="rotate-end-date" type="date" value={rotateEndDate} onChange={(e) => setRotateEndDate(e.target.value)} />
              </div>
            </div>

            {earlyRotation && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-2.5">
                <div className="flex gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800 space-y-1">
                    <p className="font-medium">
                      You&apos;re starting this rotation before the scheduled end date of the current one:
                    </p>
                    <ul className="list-disc list-inside">
                      {earlyRotation.groups.map((g) => (
                        <li key={g.studentGroupId}>
                          {g.groupName} isn&apos;t scheduled to end until {formatDate(g.currentEndDate)}
                        </li>
                      ))}
                    </ul>
                    <p>Are you sure you want to override this and start the new rotation now?</p>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-red-800 pl-6">
                  <input
                    type="checkbox"
                    checked={overrideEarlyRotation}
                    onChange={(e) => setOverrideEarlyRotation(e.target.checked)}
                    className="rounded border-red-300"
                  />
                  Yes, override and start early
                </label>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="rotate-confirm">
                Type <strong className="font-mono tracking-wider">ROTATE</strong> to confirm
              </Label>
              <Input
                id="rotate-confirm"
                placeholder="ROTATE"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="font-mono"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setConfirmText(""); }} disabled={rotating}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleRotate}
              disabled={
                confirmText !== "ROTATE" ||
                !rotateStartDate ||
                !rotateEndDate ||
                earlyRotationChecking ||
                (!!earlyRotation && !overrideEarlyRotation)
              }
              loading={rotating}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Rotate now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set up rotation modal — bootstraps positions for a brand-new group */}
      <Dialog open={!!setupGroup} onOpenChange={(o) => !o && setSetupGroup(null)}>
        <DialogContent className="max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Set up rotation for {setupGroup?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 -mt-2">
            Pick each teacher/class this group will rotate through, in order. The first one becomes
            the group&apos;s current active class; the rest are scheduled as upcoming.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="setup-start-date">First rotation starts</Label>
              <Input id="setup-start-date" type="date" value={setupStartDate} onChange={(e) => setSetupStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="setup-end-date">First rotation ends</Label>
              <Input id="setup-end-date" type="date" value={setupEndDate} onChange={(e) => setSetupEndDate(e.target.value)} />
            </div>
          </div>

          {setupSelected.length > 0 && (
            <div className="space-y-1.5">
              <Label>Order</Label>
              <ul className="space-y-1">
                {setupSelected.map((id, i) => {
                  const opt = setupOptions.find((o) => o.id === id);
                  return (
                    <li key={id} className="flex items-center gap-2 text-sm bg-white border border-gray-100 rounded-lg px-3 py-1.5">
                      <span className="text-xs font-semibold text-gray-400 w-4">{i + 1}</span>
                      <span className="flex-1 truncate">
                        {opt?.activityTemplate.name} - {opt?.teacherProfile.firstName} {opt?.teacherProfile.lastName}
                      </span>
                      <button onClick={() => toggleSetupSelection(id)} aria-label={`Remove ${opt?.activityTemplate.name}`}>
                        <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-700" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="space-y-1.5 flex-1 overflow-y-auto min-h-0">
            <Label>Available teacher/class assignments</Label>
            {setupOptionsLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : (
              <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {setupOptions.map((opt) => {
                  const selected = setupSelected.includes(opt.id);
                  return (
                    <li key={opt.id}>
                      <button
                        type="button"
                        onClick={() => toggleSetupSelection(opt.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 ${selected ? "bg-primary-50" : ""}`}
                      >
                        <span className="flex-1 truncate">
                          {opt.activityTemplate.name} - {opt.teacherProfile.firstName} {opt.teacherProfile.lastName}
                        </span>
                        {selected ? <X className="h-3.5 w-3.5 text-primary-900 shrink-0" /> : <Plus className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupGroup(null)} disabled={setupSubmitting}>Cancel</Button>
            <Button
              onClick={handleCreatePositions}
              disabled={setupSelected.length === 0 || !setupStartDate || !setupEndDate || setupSubmitting}
              loading={setupSubmitting}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create {setupSelected.length || ""} position{setupSelected.length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
