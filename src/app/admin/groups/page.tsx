"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  ChevronRight,
  Group,
  Search,
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
  memberCount: number;
  currentAssignment?: string;
}

const GRADE_LEVELS = ["6", "7", "8"];
const GENDERS = [
  { value: "MIXED", label: "Mixed" },
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

function GenderBadge({ gender }: { gender: string }) {
  const map: Record<string, string> = {
    MALE: "bg-sky-50 text-sky-700 border-sky-100",
    FEMALE: "bg-pink-50 text-pink-700 border-pink-100",
    MIXED: "bg-violet-50 text-violet-700 border-violet-100",
  };
  const labels: Record<string, string> = { MALE: "Male", FEMALE: "Female", MIXED: "Mixed" };
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
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createLoading, setCreateLoading] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", gradeLevel: "", gender: "" });
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});

  const fetchGroups = React.useCallback(() => {
    setLoading(true);
    fetch("/api/admin/student-groups")
      .then((r) => r.json())
      .then((d) => setGroups(d?.groups ?? d ?? []))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const filtered = groups.filter(
    (g) => !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.gradeLevel.includes(search)
  );

  const validateForm = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.gradeLevel) errs.gradeLevel = "Grade level is required";
    if (!form.gender) errs.gender = "Gender is required";
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
        body: JSON.stringify({ name: form.name.trim(), gradeLevel: form.gradeLevel, gender: form.gender }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Group created", description: `"${form.name}" was added.` });
      setCreateOpen(false);
      setForm({ name: "", gradeLevel: "", gender: "" });
      fetchGroups();
    } catch {
      toast({ title: "Failed to create group", variant: "destructive" });
    } finally {
      setCreateLoading(false);
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
              <li key={group.id}>
                <Link
                  href={`/admin/groups/${group.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 group"
                >
                  <div className="h-9 w-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                    <Group className="h-4 w-4 text-violet-600" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 group-hover:text-primary-700 transition-colors">
                      {group.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Grade {group.gradeLevel}
                      {group.currentAssignment ? ` · ${group.currentAssignment}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <GenderBadge gender={group.gender} />
                    <span className="text-xs text-gray-500 tabular-nums">
                      {group.memberCount} {group.memberCount === 1 ? "student" : "students"}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary-400 transition-colors" />
                  </div>
                </Link>
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
                  {GRADE_LEVELS.map((g) => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createLoading}>Cancel</Button>
            <Button onClick={handleCreate} loading={createLoading}>Create group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
