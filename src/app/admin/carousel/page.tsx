"use client";

import * as React from "react";
import {
  RotateCcw,
  Eye,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Undo2,
  GripVertical,
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

interface Position {
  id: string;
  positionOrder: number;
  teacherName: string;
  activity: string;
  assignedGroup?: {
    id: string;
    name: string;
    gradeLevel: string;
    gender: string;
  };
}

interface CarouselPlan {
  id: string;
  name: string;
  isActive: boolean;
  positions: Position[];
}

interface PreviewRow {
  groupId: string;
  groupName: string;
  currentTeacher: string;
  currentActivity: string;
  nextTeacher: string;
  nextActivity: string;
}

interface RotationRecord {
  id: string;
  executedAt: string;
  executedByName: string;
  positionsCount: number;
  isReverted: boolean;
  revertedAt?: string;
  revertedByName?: string;
  revertReason?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function GenderDot({ gender }: { gender: string }) {
  const colors: Record<string, string> = {
    MALE: "bg-sky-400",
    FEMALE: "bg-pink-400",
    MIXED: "bg-violet-400",
  };
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colors[gender] ?? "bg-gray-400"}`}
      title={gender.charAt(0) + gender.slice(1).toLowerCase()}
    />
  );
}

function PositionCard({
  position,
  index,
  total,
  onMoveUp,
  onMoveDown,
  isDragging,
}: {
  position: Position;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isDragging: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 bg-white rounded-xl border px-4 py-3 transition-all ${
        isDragging ? "border-primary-400 shadow-lg scale-[1.02]" : "border-gray-200 hover:border-gray-300"
      }`}
      role="listitem"
    >
      <div className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0" aria-hidden="true">
        <GripVertical className="h-4 w-4" />
      </div>
      <span className="text-xs font-semibold text-gray-400 tabular-nums w-5 shrink-0">{position.positionOrder}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{position.teacherName}</p>
        <p className="text-xs text-gray-500 truncate">{position.activity}</p>
      </div>
      <div className="shrink-0 text-right">
        {position.assignedGroup ? (
          <div className="flex items-center gap-1.5">
            <GenderDot gender={position.assignedGroup.gender} />
            <span className="text-sm text-gray-700 font-medium">{position.assignedGroup.name}</span>
            <span className="text-xs text-gray-400">Gr.{position.assignedGroup.gradeLevel}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-400 italic">Unassigned</span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
          aria-label="Move position up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
          aria-label="Move position down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function CarouselPage() {
  const { toast } = useToast();

  const [plan, setPlan] = React.useState<CarouselPlan | null>(null);
  const [positions, setPositions] = React.useState<Position[]>([]);
  const [rotations, setRotations] = React.useState<RotationRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [orderDirty, setOrderDirty] = React.useState(false);
  const [savingOrder, setSavingOrder] = React.useState(false);

  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<PreviewRow[]>([]);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewWarnings, setPreviewWarnings] = React.useState<string[]>([]);

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [rotating, setRotating] = React.useState(false);

  const [reopenTarget, setReopenTarget] = React.useState<RotationRecord | null>(null);
  const [reopenReason, setReopenReason] = React.useState("");
  const [reopenLoading, setReopenLoading] = React.useState(false);

  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  const fetchData = React.useCallback(() => {
    setLoading(true);
    fetch("/api/admin/carousel")
      .then((r) => r.json())
      .then((d) => {
        const p: CarouselPlan = d?.plan ?? d;
        setPlan(p);
        const sorted = [...(p?.positions ?? [])].sort((a, b) => a.positionOrder - b.positionOrder);
        setPositions(sorted);
        setRotations(d?.rotations ?? []);
      })
      .catch(() => { setPlan(null); setPositions([]); })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => { e.preventDefault(); setDragOverIndex(index); };
  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); setDragOverIndex(null); return; }
    const newPositions = [...positions];
    const [moved] = newPositions.splice(dragIndex, 1);
    newPositions.splice(targetIndex, 0, moved);
    setPositions(newPositions.map((p, i) => ({ ...p, positionOrder: i + 1 })));
    setOrderDirty(true);
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => { setDragIndex(null); setDragOverIndex(null); };

  const movePosition = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= positions.length) return;
    const newPositions = [...positions];
    [newPositions[index], newPositions[target]] = [newPositions[target], newPositions[index]];
    setPositions(newPositions.map((p, i) => ({ ...p, positionOrder: i + 1 })));
    setOrderDirty(true);
  };

  const handleSaveOrder = async () => {
    if (!plan) return;
    setSavingOrder(true);
    try {
      const res = await fetch(`/api/admin/carousel/${plan.id}/positions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions: positions.map((p) => ({ id: p.id, positionOrder: p.positionOrder })) }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Order saved" });
      setOrderDirty(false);
    } catch {
      toast({ title: "Failed to save order", variant: "destructive" });
    } finally {
      setSavingOrder(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const res = await fetch("/api/admin/carousel/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan?.id }),
      });
      const data = await res.json();
      setPreview(data?.preview ?? []);
      setPreviewWarnings(data?.warnings ?? []);
    } catch {
      setPreview([]);
      setPreviewWarnings(["Failed to load preview."]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleRotate = async () => {
    if (confirmText !== "ROTATE") return;
    setRotating(true);
    try {
      const res = await fetch("/api/admin/carousel/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan?.id }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Classes rotated", description: "All groups have been assigned to their new positions." });
      setConfirmOpen(false);
      setConfirmText("");
      setPreviewOpen(false);
      fetchData();
    } catch {
      toast({ title: "Rotation failed", variant: "destructive" });
    } finally {
      setRotating(false);
    }
  };

  const handleReopen = async () => {
    if (!reopenTarget || !reopenReason.trim()) return;
    setReopenLoading(true);
    try {
      const res = await fetch(`/api/admin/rotations/${reopenTarget.id}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reopenReason.trim() }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Rotation reopened" });
      setReopenTarget(null);
      setReopenReason("");
      fetchData();
    } catch {
      toast({ title: "Failed to reopen rotation", variant: "destructive" });
    } finally {
      setReopenLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Carousel &amp; Rotations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{plan?.name ?? "Loading carousel plan…"}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {orderDirty && (
            <Button variant="outline" size="sm" onClick={handleSaveOrder} loading={savingOrder}>
              Save order
            </Button>
          )}
          <Button variant="outline" onClick={handlePreview}>
            <Eye className="h-4 w-4" aria-hidden="true" />
            Preview next rotation
          </Button>
          <Button onClick={() => setConfirmOpen(true)}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Rotate classes
          </Button>
        </div>
      </div>

      {/* Positions */}
      <section aria-labelledby="positions-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="positions-heading" className="text-sm font-semibold text-gray-700">Carousel Positions</h2>
          <p className="text-xs text-gray-400">Drag or use arrows to reorder</p>
        </div>
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
        ) : positions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
            <RotateCcw className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No carousel positions configured.</p>
          </div>
        ) : (
          <div className="space-y-2" role="list" aria-label="Carousel positions">
            {positions.map((position, index) => (
              <div
                key={position.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={`transition-opacity ${dragIndex === index ? "opacity-40" : "opacity-100"} ${dragOverIndex === index && dragIndex !== index ? "ring-2 ring-primary-400 ring-offset-1 rounded-xl" : ""}`}
              >
                <PositionCard
                  position={position}
                  index={index}
                  total={positions.length}
                  onMoveUp={() => movePosition(index, -1)}
                  onMoveDown={() => movePosition(index, 1)}
                  isDragging={dragIndex === index}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* History */}
      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-sm font-semibold text-gray-700 mb-3">Rotation History</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {rotations.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="h-7 w-7 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No rotations yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[580px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Executed by</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Positions</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rotations.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">{formatDate(r.executedAt)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.executedByName}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 tabular-nums">{r.positionsCount}</td>
                      <td className="px-4 py-3">
                        {r.isReverted ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                            <Undo2 className="h-3 w-3" />Reverted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                            <CheckCircle2 className="h-3 w-3" />Complete
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!r.isReverted && (
                          <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setReopenTarget(r); setReopenReason(""); }}>
                            <Undo2 className="h-3 w-3" aria-hidden="true" />
                            Reopen
                          </Button>
                        )}
                        {r.isReverted && r.revertReason && (
                          <span className="text-xs text-gray-400 italic truncate max-w-[140px] block" title={r.revertReason}>
                            &ldquo;{r.revertReason}&rdquo;
                          </span>
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

      {/* Preview modal */}
      <Dialog open={previewOpen} onOpenChange={(o) => !o && setPreviewOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader><DialogTitle>Preview next rotation</DialogTitle></DialogHeader>
          {previewWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 space-y-1">
                {previewWarnings.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {previewLoading ? (
              <div className="space-y-2 py-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : preview.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">No groups to preview.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">Group</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">Current</th>
                      <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">Next</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((row) => (
                      <tr key={row.groupId} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-medium text-gray-900">{row.groupName}</td>
                        <td className="px-3 py-2.5 text-gray-600">
                          <span className="block">{row.currentTeacher}</span>
                          <span className="text-xs text-gray-400">{row.currentActivity}</span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-800">
                          <span className="block font-medium">{row.nextTeacher}</span>
                          <span className="text-xs text-gray-500">{row.nextActivity}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
            <Button onClick={() => { setPreviewOpen(false); setConfirmOpen(true); }}>
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
            <p className="text-sm text-gray-600">
              This will advance all student groups to their next carousel positions. This action is logged and can be reopened by an administrator.
            </p>
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
            <Button variant="destructive" onClick={handleRotate} disabled={confirmText !== "ROTATE"} loading={rotating}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Rotate now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen modal */}
      <Dialog open={!!reopenTarget} onOpenChange={(o) => !o && setReopenTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-4 w-4 text-amber-500" aria-hidden="true" />
              Reopen rotation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {reopenTarget && (
              <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
                <p className="text-gray-500 text-xs mb-0.5">Rotation executed</p>
                <p className="font-medium text-gray-900">{formatDate(reopenTarget.executedAt)}</p>
                <p className="text-gray-500">by {reopenTarget.executedByName}</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="reopen-reason">
                Reason <span className="text-red-500 text-xs font-normal">(required)</span>
              </Label>
              <Textarea
                id="reopen-reason"
                placeholder="Explain why this rotation is being reopened…"
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenTarget(null)} disabled={reopenLoading}>Cancel</Button>
            <Button variant="warning" onClick={handleReopen} disabled={!reopenReason.trim()} loading={reopenLoading}>
              Reopen rotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
