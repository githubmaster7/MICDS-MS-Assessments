"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  UserPlus,
  UserMinus,
  AlertTriangle,
  Search,
  Users,
  Clock,
} from "lucide-react";
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

interface GroupDetail {
  id: string;
  name: string;
  gradeLevel: string;
  gender: string;
  memberCount: number;
  currentAssignment?: {
    teacherName: string;
    activity: string;
    rotationName: string;
  };
}

interface Member {
  id: string;
  name: string;
  email: string;
}

interface RotationHistory {
  id: string;
  rotationName: string;
  teacherName: string;
  activity: string;
  startDate: string;
  endDate?: string;
}

interface AvailableStudent {
  id: string;
  name: string;
  email: string;
}

function formatDate(iso?: string) {
  if (!iso) return "Present";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export default function StudentGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [group, setGroup] = React.useState<GroupDetail | null>(null);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [history, setHistory] = React.useState<RotationHistory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [memberSearch, setMemberSearch] = React.useState("");

  const [addOpen, setAddOpen] = React.useState(false);
  const [addSearch, setAddSearch] = React.useState("");
  const [available, setAvailable] = React.useState<AvailableStudent[]>([]);
  const [addLoading, setAddLoading] = React.useState(false);

  const [removeTarget, setRemoveTarget] = React.useState<Member | null>(null);
  const [removeLoading, setRemoveLoading] = React.useState(false);

  const fetchGroup = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/student-groups/${id}`).then((r) => r.json()),
      fetch(`/api/admin/student-groups/${id}/members`).then((r) => r.json()),
    ])
      .then(([groupData, membersData]) => {
        setGroup(groupData?.group ?? groupData);
        setMembers(membersData?.members ?? membersData ?? []);
        setHistory(groupData?.rotationHistory ?? []);
      })
      .catch(() => { setGroup(null); setMembers([]); })
      .finally(() => setLoading(false));
  }, [id]);

  React.useEffect(() => { fetchGroup(); }, [fetchGroup]);

  React.useEffect(() => {
    if (!addOpen) return;
    fetch(`/api/admin/users?role=STUDENT&status=ACTIVE&limit=100`)
      .then((r) => r.json())
      .then((d) => {
        const memberIds = new Set(members.map((m) => m.id));
        setAvailable((d?.users ?? []).filter((u: AvailableStudent) => !memberIds.has(u.id)));
      })
      .catch(() => setAvailable([]));
  }, [addOpen, members]);

  const filteredMembers = members.filter(
    (m) => !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase()) || m.email.toLowerCase().includes(memberSearch.toLowerCase())
  );
  const filteredAvailable = available.filter(
    (s) => !addSearch || s.name.toLowerCase().includes(addSearch.toLowerCase()) || s.email.toLowerCase().includes(addSearch.toLowerCase())
  );

  const handleAddMember = async (student: AvailableStudent) => {
    setAddLoading(true);
    try {
      const res = await fetch(`/api/admin/student-groups/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Member added", description: `${student.name} joined the group.` });
      fetchGroup();
      setAvailable((prev) => prev.filter((s) => s.id !== student.id));
    } catch {
      toast({ title: "Failed to add member", variant: "destructive" });
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    setRemoveLoading(true);
    try {
      const res = await fetch(`/api/admin/student-groups/${id}/members?studentId=${removeTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast({ title: "Member removed" });
      setRemoveTarget(null);
      fetchGroup();
    } catch {
      toast({ title: "Failed to remove member", variant: "destructive" });
    } finally {
      setRemoveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-16">
          <AlertTriangle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Group not found.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/admin/groups")}>
            Back to groups
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link
        href="/admin/groups"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All groups
      </Link>

      {/* Group info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="h-12 w-12 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
            <Users className="h-6 w-6 text-violet-600" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-gray-900">{group.name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Grade {group.gradeLevel} · {group.gender.charAt(0) + group.gender.slice(1).toLowerCase()} · {group.memberCount} {group.memberCount === 1 ? "student" : "students"}
            </p>
          </div>
          {group.currentAssignment && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm">
              <p className="text-xs text-blue-500 font-medium uppercase tracking-wide mb-0.5">Current rotation</p>
              <p className="text-blue-800 font-medium">{group.currentAssignment.teacherName}</p>
              <p className="text-blue-600 text-xs">{group.currentAssignment.activity} · {group.currentAssignment.rotationName}</p>
            </div>
          )}
        </div>
      </div>

      {/* Members */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Members</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" aria-hidden="true" />
              <Input placeholder="Search members…" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} className="pl-7 h-7 text-xs w-40" aria-label="Search members" />
            </div>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              Add student
            </Button>
          </div>
        </div>
        {filteredMembers.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="h-7 w-7 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{memberSearch ? "No matching members." : "No members yet."}</p>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-gray-100">
            {filteredMembers.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-medium text-gray-600">{member.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                  <p className="text-xs text-gray-500 truncate">{member.email}</p>
                </div>
                <button
                  onClick={() => setRemoveTarget(member)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  aria-label={`Remove ${member.name} from group`}
                >
                  <UserMinus className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Rotation history */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-gray-900">Rotation History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rotation</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Teacher</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Activity</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{h.rotationName}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">{h.teacherName}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">{h.activity}</td>
                    <td className="px-5 py-3 text-xs text-gray-500 tabular-nums">
                      {formatDate(h.startDate)} – {formatDate(h.endDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add member modal */}
      <Dialog open={addOpen} onOpenChange={(o) => !o && setAddOpen(false)}>
        <DialogContent className="max-h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>Add student to {group.name}</DialogTitle></DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
            <Input placeholder="Search students…" value={addSearch} onChange={(e) => setAddSearch(e.target.value)} className="pl-8" aria-label="Search available students" />
          </div>
          <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg">
            {filteredAvailable.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                {addSearch ? "No students match your search." : "All students are already in this group."}
              </div>
            ) : (
              <ul role="list" className="divide-y divide-gray-100">
                {filteredAvailable.map((student) => (
                  <li key={student.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-gray-600">{student.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{student.name}</p>
                      <p className="text-xs text-gray-500 truncate">{student.email}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleAddMember(student)} disabled={addLoading} aria-label={`Add ${student.name}`}>
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter className="mt-3">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <Dialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Remove from group
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            Remove <strong>{removeTarget?.name}</strong> from <strong>{group.name}</strong>? Their grade history is preserved.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removeLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveMember} loading={removeLoading}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
