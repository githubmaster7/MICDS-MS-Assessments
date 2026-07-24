"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  ChevronRight,
  Group,
  Search,
  RotateCcw,
  Trash2,
  AlertTriangle,
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
import { useToast } from "@/components/ui/use-toast";

interface StudentGroup {
  id: string;
  name: string;
  gradeLevel: string;
  gender: string;
  isActive: boolean;
  _count: { memberships: number };
  schoolYear: { id: string; name: string };
  groupRotationAssignments: Array<{
    carouselPosition: {
      teacherClassAssignment: {
        activityTemplate: { name: string };
        teacherProfile: { firstName: string; lastName: string };
      };
    };
  }>;
}

interface SchoolYear {
  id: string;
  name: string;
  isActive: boolean;
}

const GRADE_LEVELS = [
  { value: "GRADE_5", label: "5" },
  { value: "GRADE_6", label: "6" },
  { value: "GRADE_7", label: "7" },
  { value: "GRADE_8", label: "8" },
];
// No "Mixed" option — the spec requires every group/class to be single-gender.
const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

function gradeLevelLabel(gradeLevel: string): string {
  return GRADE_LEVELS.find((g) => g.value === gradeLevel)?.label ?? gradeLevel;
}

function currentAssignmentLabel(group: StudentGroup): string | null {
  const assignment = group.groupRotationAssignments[0]?.carouselPosition.teacherClassAssignment;
  if (!assignment) return null;
  return `${assignment.activityTemplate.name} · ${assignment.teacherProfile.firstName} ${assignment.teacherProfile.lastName}`;
}

function GenderBadge({ gender }: { gender: string }) {
  const map: Record<string, string> = {
    MALE: "bg-sky-50 text-sky-700 border-sky-100",
    FEMALE: "bg-pink-50 text-pink-700 border-pink-100",
  };
  const labels: Record<string, string> = { MALE: "Boys", FEMALE: "Girls" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[gender] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {labels[gender] ?? gender}
    </span>
  );
}

export default function StudentGroupsPage() {
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [groups, setGroups] = React.useState<StudentGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [schoolYears, setSchoolYears] = React.useState<SchoolYear[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", gradeLevel: "", gender: "", schoolYearId: "" });
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [removeTarget, setRemoveTarget] = React.useState<StudentGroup | null>(null);
  const [removeLoading, setRemoveLoading] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<StudentGroup | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  const fetchGroups = React.useCallback(() => {
    setLoading(true);
    fetch("/api/admin/student-groups")
      .then((r) => r.json())
      .then((d) => setGroups(d?.data ?? []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { fetchGroups(); }, [fetchGroups]);

  React.useEffect(() => {
    fetch("/api/admin/school-years")
      .then((r) => r.json())
      .then((d) => {
        const years: SchoolYear[] = d?.data ?? [];
        setSchoolYears(years);
        const defaultYear = years.find((y) => y.isActive) ?? years[0];
        if (defaultYear) setForm((f) => ({ ...f, schoolYearId: defaultYear.id }));
      })
      .catch(() => setSchoolYears([]));
  }, []);

  const filtered = groups.filter(
    (g) => !search || g.name.toLowerCase().includes(search.toLowerCase()) || gradeLevelLabel(g.gradeLevel).includes(search)
  );

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.gradeLevel) errs.gradeLevel = "Grade level is required";
    if (!form.gender) errs.gender = "Gender is required";
    if (!form.schoolYearId) errs.schoolYearId = "School year is required";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    setCreateLoading(true);
    try {
      const res = await fetch("/api/admin/student-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          gradeLevel: form.gradeLevel,
          gender: form.gender,
          schoolYearId: form.schoolYearId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to create group");
      toast({ title: "Group created", description: `"${form.name}" was added.` });
      setCreateOpen(false);
      setForm((f) => ({ ...f, name: "", gradeLevel: "", gender: "" }));
      fetchGroups();
    } catch (e) {
      toast({
        title: "Failed to create group",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRestore = async (group: StudentGroup) => {
    try {
      const res = await fetch(`/api/admin/student-groups/${group.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to restore group");
      toast({ title: "Group restored", description: `"${group.name}" is active again.` });
      fetchGroups();
    } catch (e) {
      toast({ title: "Failed to restore group", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoveLoading(true);
    try {
      const res = await fetch(`/api/admin/student-groups/${removeTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to remove group");
      toast({ title: "Group removed", description: `"${removeTarget.name}" was deactivated.` });
      setRemoveTarget(null);
      fetchGroups();
    } catch (e) {
      toast({ title: "Failed to remove group", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setRemoveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirmText !== deleteTarget.name) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/student-groups/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to permanently delete group");
      toast({ title: "Group permanently deleted", description: `"${deleteTarget.name}" has been removed for good.` });
      setDeleteTarget(null);
      setDeleteConfirmText("");
      fetchGroups();
    } catch (e) {
      toast({ title: "Failed to delete group", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Student Groups</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage carousel rotation groups.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          New group
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
        <Input
          placeholder="Search groups…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
          aria-label="Search groups"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Group className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{search ? "No groups match your search." : "No student groups yet."}</p>
            {!search && (
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Create first group
              </Button>
            )}
          </div>
        ) : (
          <ul role="list" className="divide-y divide-gray-100">
            {filtered.map((group) => (
              <li key={group.id} className={`flex items-center gap-2 px-5 py-2 ${!group.isActive ? "opacity-60" : ""}`}>
                <Link
                  href={`/admin/groups/${group.id}`}
                  className="flex flex-1 min-w-0 items-center gap-4 py-2 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 rounded-lg group"
                >
                  <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                    <Group className="h-4 w-4 text-violet-600" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-primary-700 transition-colors">
                      {group.name}
                      {!group.isActive && <span className="ml-2 text-[11px] font-medium text-gray-400">(Removed)</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Grade {gradeLevelLabel(group.gradeLevel)}
                      {currentAssignmentLabel(group) ? ` · ${currentAssignmentLabel(group)}` : " · No active rotation"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <GenderBadge gender={group.gender} />
                    <span className="text-xs text-gray-500 tabular-nums">
                      {group._count.memberships} {group._count.memberships === 1 ? "student" : "students"}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary-400 transition-colors" />
                  </div>
                </Link>
                {group.isActive ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs shrink-0"
                    onClick={() => setRemoveTarget(group)}
                    aria-label={`Remove ${group.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => handleRestore(group)}
                      aria-label={`Restore ${group.name}`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => { setDeleteTarget(group); setDeleteConfirmText(""); }}
                      aria-label={`Permanently delete ${group.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Delete permanently
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create student group</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                placeholder="e.g. Group A"
                value={form.name}
                onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); if (formErrors.name) setFormErrors((fe) => ({ ...fe, name: "" })); }}
                error={!!formErrors.name}
              />
              {formErrors.name && <p className="text-xs text-red-600">{formErrors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-grade">Grade level</Label>
              <Select value={form.gradeLevel} onValueChange={(v) => { setForm((f) => ({ ...f, gradeLevel: v })); if (formErrors.gradeLevel) setFormErrors((fe) => ({ ...fe, gradeLevel: "" })); }}>
                <SelectTrigger id="group-grade"><SelectValue placeholder="Select grade" /></SelectTrigger>
                <SelectContent>
                  {GRADE_LEVELS.map((g) => <SelectItem key={g.value} value={g.value}>Grade {g.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {formErrors.gradeLevel && <p className="text-xs text-red-600">{formErrors.gradeLevel}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-gender">Gender</Label>
              <Select value={form.gender} onValueChange={(v) => { setForm((f) => ({ ...f, gender: v })); if (formErrors.gender) setFormErrors((fe) => ({ ...fe, gender: "" })); }}>
                <SelectTrigger id="group-gender"><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {formErrors.gender && <p className="text-xs text-red-600">{formErrors.gender}</p>}
            </div>
            {schoolYears.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="group-school-year">School year</Label>
                <Select value={form.schoolYearId} onValueChange={(v) => { setForm((f) => ({ ...f, schoolYearId: v })); if (formErrors.schoolYearId) setFormErrors((fe) => ({ ...fe, schoolYearId: "" })); }}>
                  <SelectTrigger id="group-school-year"><SelectValue placeholder="Select school year" /></SelectTrigger>
                  <SelectContent>
                    {schoolYears.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formErrors.schoolYearId && <p className="text-xs text-red-600">{formErrors.schoolYearId}</p>}
              </div>
            )}
            {schoolYears.length === 0 && (
              <p className="text-xs text-amber-600">No school years exist yet — create one before adding groups.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createLoading}>Cancel</Button>
            <Button onClick={handleCreate} loading={createLoading}>Create group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Remove group
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            Remove <strong>{removeTarget?.name}</strong>? It will no longer appear in active rotations
            or new carousel assignments, but its members and grade history are preserved. You can
            restore it at any time.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removeLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemove} loading={removeLoading}>Remove group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Permanently delete group
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              This permanently deletes <strong>{deleteTarget?.name}</strong> and cannot be undone. Only
              groups with no rotation or grade history can be deleted this way — groups with real
              history must stay archived instead.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm">
                Type <strong className="font-mono">{deleteTarget?.name}</strong> to confirm
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }} disabled={deleteLoading}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirmText !== deleteTarget?.name}
              loading={deleteLoading}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
