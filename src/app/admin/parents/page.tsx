"use client";

import * as React from "react";
import { Search, UserRound, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

interface LinkedStudent {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  gradeLevel: string;
}

interface ParentLink {
  id: string;
  createdAt: string;
  student: LinkedStudent;
}

interface ParentRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  links: ParentLink[];
}

interface StudentOption {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  gradeLevel: string;
}

const GRADE_LABELS: Record<string, string> = { GRADE_5: "5", GRADE_6: "6", GRADE_7: "7", GRADE_8: "8" };

export default function AdminParentsPage() {
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [parents, setParents] = React.useState<ParentRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [linkTarget, setLinkTarget] = React.useState<ParentRow | null>(null);
  const [studentSearch, setStudentSearch] = React.useState("");
  const [studentResults, setStudentResults] = React.useState<StudentOption[]>([]);
  const [studentSearchLoading, setStudentSearchLoading] = React.useState(false);
  const [addingStudentId, setAddingStudentId] = React.useState<string | null>(null);

  const [removeTarget, setRemoveTarget] = React.useState<{ parent: ParentRow; link: ParentLink } | null>(null);
  const [removeLoading, setRemoveLoading] = React.useState(false);

  const fetchParents = React.useCallback(() => {
    setLoading(true);
    fetch("/api/admin/parents")
      .then((r) => r.json())
      .then((d) => setParents(d?.data ?? []))
      .catch(() => setParents([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { fetchParents(); }, [fetchParents]);

  React.useEffect(() => {
    if (!linkTarget) return;
    const t = setTimeout(() => {
      setStudentSearchLoading(true);
      const params = new URLSearchParams();
      if (studentSearch.trim()) params.set("search", studentSearch.trim());
      fetch(`/api/admin/students?${params}`)
        .then((r) => r.json())
        .then((d) => setStudentResults(d?.data ?? []))
        .catch(() => setStudentResults([]))
        .finally(() => setStudentSearchLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [linkTarget, studentSearch]);

  const filtered = parents.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
    );
  });

  const linkedStudentIds = new Set(linkTarget?.links.map((l) => l.student.id));

  const openLinkDialog = (parent: ParentRow) => {
    setLinkTarget(parent);
    setStudentSearch("");
    setStudentResults([]);
  };

  const handleAddLink = async (studentProfileId: string) => {
    if (!linkTarget) return;
    setAddingStudentId(studentProfileId);
    try {
      const res = await fetch(`/api/admin/parents/${linkTarget.id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentProfileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to link student");
      toast({ title: "Student linked" });
      fetchParents();
    } catch (e) {
      toast({ title: "Failed to link student", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setAddingStudentId(null);
    }
  };

  const handleRemoveLink = async () => {
    if (!removeTarget) return;
    setRemoveLoading(true);
    try {
      const res = await fetch(`/api/admin/parents/${removeTarget.parent.id}/links/${removeTarget.link.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to remove link");
      toast({ title: "Link removed" });
      setRemoveTarget(null);
      fetchParents();
    } catch (e) {
      toast({ title: "Failed to remove link", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setRemoveLoading(false);
    }
  };

  // Keep the open dialog's link list in sync after a fetch completes.
  React.useEffect(() => {
    if (!linkTarget) return;
    const fresh = parents.find((p) => p.id === linkTarget.id);
    if (fresh && fresh !== linkTarget) setLinkTarget(fresh);
  }, [parents, linkTarget]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Parents</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Link parent accounts to their children so parents can view read-only assessment history.
        </p>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
        <Input
          placeholder="Search parents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
          aria-label="Search parents"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <UserRound className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              {search ? "No parents match your search." : "No approved parent accounts yet."}
            </p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-gray-100">
            {filtered.map((parent) => (
              <li key={parent.id} className="px-5 py-4">
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                    <UserRound className="h-4 w-4 text-purple-600" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{parent.firstName} {parent.lastName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{parent.email}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openLinkDialog(parent)}>
                    <Plus className="h-3.5 w-3.5" />
                    Link child
                  </Button>
                </div>
                {parent.links.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pl-[52px]">
                    {parent.links.map((link) => (
                      <span
                        key={link.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 pl-2.5 pr-1.5 py-1 text-xs text-gray-700"
                      >
                        {link.student.firstName} {link.student.lastName}
                        <span className="text-gray-400">
                          · Grade {GRADE_LABELS[link.student.gradeLevel] ?? link.student.gradeLevel}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRemoveTarget({ parent, link })}
                          className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                          aria-label={`Remove link to ${link.student.firstName} ${link.student.lastName}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {parent.links.length === 0 && (
                  <p className="text-xs text-gray-400 mt-2 pl-[52px]">No students linked yet.</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Link child dialog */}
      <Dialog open={!!linkTarget} onOpenChange={(o) => !o && setLinkTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link a child to {linkTarget?.firstName} {linkTarget?.lastName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
              <Input
                autoFocus
                placeholder="Search by student name or ID…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
              {studentSearchLoading ? (
                <div className="p-4 text-center text-sm text-gray-400">Searching…</div>
              ) : studentResults.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">
                  {studentSearch ? "No students match." : "Type to search students."}
                </div>
              ) : (
                studentResults.map((s) => {
                  const alreadyLinked = linkedStudentIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={alreadyLinked || addingStudentId === s.id}
                      onClick={() => handleAddLink(s.id)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <span>
                        <span className="font-medium text-gray-900">{s.firstName} {s.lastName}</span>
                        <span className="text-gray-400 ml-1.5">
                          Grade {GRADE_LABELS[s.gradeLevel] ?? s.gradeLevel} · {s.studentId}
                        </span>
                      </span>
                      <span className="text-xs text-primary-600 font-medium shrink-0">
                        {alreadyLinked ? "Linked" : addingStudentId === s.id ? "Adding…" : "Add"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkTarget(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove link confirmation */}
      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove link?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            {removeTarget?.parent.firstName} {removeTarget?.parent.lastName} will no longer be able to see{" "}
            {removeTarget?.link.student.firstName} {removeTarget?.link.student.lastName}&apos;s assessment data.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removeLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveLink} loading={removeLoading}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
