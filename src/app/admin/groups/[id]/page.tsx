"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  UserPlus,
  UserMinus,
  AlertTriangle,
  Search,
  Users,
  Clock,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
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
import { ClassInstanceAnalyticsView } from "@/components/shared/ClassInstanceAnalyticsView";
import { BarChart3 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";

interface RotationAssignment {
  id: string;
  rotationNumber: number;
  status: string;
  startDate: string;
  endDate: string;
  carouselPosition: {
    teacherClassAssignment: {
      teacherProfile: { firstName: string; lastName: string };
      activityTemplate: { name: string };
    };
  };
  historicalClassInstances: { id: string }[];
}

interface GroupDetail {
  id: string;
  name: string;
  gradeLevel: string;
  gender: string;
  isActive: boolean;
  schoolYear: { id: string; name: string };
  _count: { memberships: number };
  groupRotationAssignments: RotationAssignment[];
}

interface Member {
  id: string; // membership id
  studentProfileId: string;
  firstName: string;
  lastName: string;
  studentId: string;
}

interface AvailableStudent {
  id: string; // studentProfileId
  firstName: string;
  lastName: string;
  email: string;
}

interface ClassGrade {
  rotationNumber: number;
  activityName: string;
  teacherName: string;
  status: string;
  letterGrade: string | null;
  overallAverage: number | null;
  standard1Score: number | null;
  standard2Score: number | null;
  standard3Score: number | null;
  standard4Score: number | null;
}

interface StudentGrades {
  studentProfileId: string;
  firstName: string;
  lastName: string;
  studentId: string;
  classes: ClassGrade[];
}

const GRADE_LABELS: Record<string, string> = { GRADE_5: "5", GRADE_6: "6", GRADE_7: "7", GRADE_8: "8" };
const GENDER_LABELS: Record<string, string> = { MALE: "Boys", FEMALE: "Girls" };

export default function StudentGroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [group, setGroup] = React.useState<GroupDetail | null>(null);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [memberSearch, setMemberSearch] = React.useState("");

  const [addOpen, setAddOpen] = React.useState(false);
  const [addSearch, setAddSearch] = React.useState("");
  const [available, setAvailable] = React.useState<AvailableStudent[]>([]);
  const [addLoading, setAddLoading] = React.useState(false);

  const [removeTarget, setRemoveTarget] = React.useState<Member | null>(null);
  const [removeLoading, setRemoveLoading] = React.useState(false);

  const [removeGroupOpen, setRemoveGroupOpen] = React.useState(false);
  const [groupActionLoading, setGroupActionLoading] = React.useState(false);

  const [deleteGroupOpen, setDeleteGroupOpen] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  const [grades, setGrades] = React.useState<Map<string, StudentGrades>>(new Map());
  const [expandedStudentId, setExpandedStudentId] = React.useState<string | null>(null);

  const fetchGroup = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/student-groups/${id}`).then((r) => r.json()),
      fetch(`/api/admin/student-groups/${id}/members`).then((r) => r.json()),
      fetch(`/api/admin/student-groups/${id}/grades`).then((r) => r.json()),
    ])
      .then(([groupData, membersData, gradesData]) => {
        setGroup(groupData?.data ?? null);
        setMembers(
          (membersData?.data ?? []).map(
            (m: { id: string; studentProfileId: string; studentProfile: { firstName: string; lastName: string; studentId: string } }) => ({
              id: m.id,
              studentProfileId: m.studentProfileId,
              firstName: m.studentProfile.firstName,
              lastName: m.studentProfile.lastName,
              studentId: m.studentProfile.studentId,
            })
          )
        );
        const gradesList: StudentGrades[] = gradesData?.data ?? [];
        setGrades(new Map(gradesList.map((g) => [g.studentProfileId, g])));
      })
      .catch(() => { setGroup(null); setMembers([]); setGrades(new Map()); })
      .finally(() => setLoading(false));
  }, [id]);

  React.useEffect(() => { fetchGroup(); }, [fetchGroup]);

  React.useEffect(() => {
    if (!addOpen || !group) return;
    // Filtered server-side by grade/gender (not fetched-then-filtered
    // client-side) so a school with more than one page of active students
    // can't have genuinely-eligible students silently disappear from this
    // picker once the page-size cap is hit before the eligibility filter runs.
    const params = new URLSearchParams({
      role: 'STUDENT',
      status: 'ACTIVE',
      gradeLevel: group.gradeLevel,
      gender: group.gender,
      pageSize: '100',
    });
    fetch(`/api/admin/users?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        const memberIds = new Set(members.map((m) => m.studentProfileId));
        const users: Array<{ studentProfile?: { id: string; firstName: string; lastName: string; gradeLevel: string; gender: string }; email: string }> = d?.data ?? [];
        const students = users
          .filter((u) => u.studentProfile && !memberIds.has(u.studentProfile.id))
          .map((u) => ({
            id: u.studentProfile!.id,
            firstName: u.studentProfile!.firstName,
            lastName: u.studentProfile!.lastName,
            email: u.email,
          }));
        setAvailable(students);
      })
      .catch(() => setAvailable([]));
  }, [addOpen, members, group]);

  const filteredMembers = members.filter(
    (m) =>
      !memberSearch ||
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.studentId.toLowerCase().includes(memberSearch.toLowerCase())
  );
  const filteredAvailable = available.filter(
    (s) =>
      !addSearch ||
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(addSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(addSearch.toLowerCase())
  );

  const handleAddMember = async (student: AvailableStudent) => {
    setAddLoading(true);
    try {
      const res = await fetch(`/api/admin/student-groups/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentProfileId: student.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to add member");
      toast({ title: "Member added", description: `${student.firstName} ${student.lastName} joined the group.` });
      fetchGroup();
      setAvailable((prev) => prev.filter((s) => s.id !== student.id));
    } catch (e) {
      toast({
        title: "Failed to add member",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setAddLoading(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removeTarget) return;
    setRemoveLoading(true);
    try {
      const res = await fetch(`/api/admin/student-groups/${id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentProfileId: removeTarget.studentProfileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to remove member");
      toast({ title: "Member removed" });
      setRemoveTarget(null);
      fetchGroup();
    } catch (e) {
      toast({
        title: "Failed to remove member",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setRemoveLoading(false);
    }
  };

  const handleToggleGroupActive = async (nextActive: boolean) => {
    setGroupActionLoading(true);
    try {
      const res = await fetch(`/api/admin/student-groups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to update group");
      toast({ title: nextActive ? "Group restored" : "Group removed" });
      setRemoveGroupOpen(false);
      fetchGroup();
    } catch (e) {
      toast({
        title: nextActive ? "Failed to restore group" : "Failed to remove group",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setGroupActionLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group || deleteConfirmText !== group.name) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/student-groups/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to permanently delete group");
      toast({ title: "Group permanently deleted" });
      router.push("/admin/groups");
    } catch (e) {
      toast({
        title: "Failed to delete group",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
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

  const activeAssignment = group.groupRotationAssignments.find((a) => a.status === "ACTIVE");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {group.name}
            {!group.isActive && (
              <span className="text-xs font-medium rounded-full border border-gray-200 bg-gray-100 text-gray-500 px-2 py-0.5">Removed</span>
            )}
          </span>
        }
        description={`Grade ${GRADE_LABELS[group.gradeLevel] ?? group.gradeLevel} · ${GENDER_LABELS[group.gender] ?? group.gender} · ${group.schoolYear.name} · ${group._count.memberships} ${group._count.memberships === 1 ? "student" : "students"}`}
        backHref="/admin/groups"
        backLabel="All groups"
        actions={
          group.isActive ? (
            <Button size="sm" variant="outline" className="text-xs shrink-0" onClick={() => setRemoveGroupOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Remove group
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => handleToggleGroupActive(true)}
                loading={groupActionLoading}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Restore group
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => { setDeleteGroupOpen(true); setDeleteConfirmText(""); }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Delete permanently
              </Button>
            </div>
          )
        }
      />

      {activeAssignment && (
        <div className="bg-primary-50 border border-primary-100 rounded-lg px-3 py-2 text-sm">
          <p className="text-xs text-primary-900 font-medium uppercase tracking-wide mb-0.5">Current rotation</p>
          <p className="text-primary-800 font-medium">
            {activeAssignment.carouselPosition.teacherClassAssignment.teacherProfile.firstName}{" "}
            {activeAssignment.carouselPosition.teacherClassAssignment.teacherProfile.lastName}
          </p>
          <p className="text-primary-900 text-xs">
            {activeAssignment.carouselPosition.teacherClassAssignment.activityTemplate.name} · Rotation {activeAssignment.rotationNumber}
          </p>
        </div>
      )}

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
            {filteredMembers.map((member) => {
              const isExpanded = expandedStudentId === member.studentProfileId;
              const studentGrades = grades.get(member.studentProfileId);
              return (
                <li key={member.id}>
                  <div
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setExpandedStudentId(isExpanded ? null : member.studentProfileId)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedStudentId(isExpanded ? null : member.studentProfileId); } }}
                  >
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                    <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-gray-600">{member.firstName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{member.firstName} {member.lastName}</p>
                      <p className="text-xs text-gray-500 truncate">{member.studentId}</p>
                    </div>
                    <span className="text-xs text-gray-400 tabular-nums">
                      {studentGrades?.classes.length ?? 0} {studentGrades?.classes.length === 1 ? "class" : "classes"} graded
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setRemoveTarget(member); }}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      aria-label={`Remove ${member.firstName} ${member.lastName} from group`}
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="px-5 pb-4">
                      {!studentGrades || studentGrades.classes.length === 0 ? (
                        <p className="text-xs text-gray-400 py-3 pl-7">No grades recorded yet this year.</p>
                      ) : (
                        <div className="overflow-x-auto border border-primary-200 rounded-lg bg-white ml-7">
                          <table className="w-full text-left min-w-[560px]">
                            <thead>
                              <tr className="border-b border-gray-100 bg-primary-50">
                                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Rotation</th>
                                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Class</th>
                                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Teacher</th>
                                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-center">S1</th>
                                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-center">S2</th>
                                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-center">S3</th>
                                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-center">S4</th>
                                <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide text-center">Grade</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {studentGrades.classes.map((c) => (
                                <tr key={`${c.rotationNumber}-${c.activityName}`} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 text-xs text-gray-500 tabular-nums">{c.rotationNumber}</td>
                                  <td className="px-3 py-2 text-sm text-gray-900">{c.activityName}</td>
                                  <td className="px-3 py-2 text-sm text-gray-600">{c.teacherName}</td>
                                  <td className="px-3 py-2 text-xs text-gray-600 text-center tabular-nums">{c.standard1Score ?? "-"}</td>
                                  <td className="px-3 py-2 text-xs text-gray-600 text-center tabular-nums">{c.standard2Score ?? "-"}</td>
                                  <td className="px-3 py-2 text-xs text-gray-600 text-center tabular-nums">{c.standard3Score ?? "-"}</td>
                                  <td className="px-3 py-2 text-xs text-gray-600 text-center tabular-nums">{c.standard4Score ?? "-"}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-800">
                                      {c.letterGrade ?? "-"}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Rotation history */}
      {group.groupRotationAssignments.length > 0 && (
        <div className="bg-white rounded-xl border border-primary-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-gray-900">Rotation History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[480px]">
              <thead>
                <tr className="border-b border-gray-100 bg-primary-50">
                  <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rotation</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Teacher</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Activity</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Period</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {group.groupRotationAssignments.map((h) => {
                  return (
                    <tr key={h.id} className="hover:bg-gray-50 transition-colors align-top">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">Rotation {h.rotationNumber}</td>
                      <td className="px-5 py-3 text-sm text-gray-700">
                        {h.carouselPosition.teacherClassAssignment.teacherProfile.firstName}{" "}
                        {h.carouselPosition.teacherClassAssignment.teacherProfile.lastName}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-700">{h.carouselPosition.teacherClassAssignment.activityTemplate.name}</td>
                      <td className="px-5 py-3 text-xs text-gray-500 tabular-nums">
                        {formatDate(h.startDate)} – {formatDate(h.endDate)}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">{h.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Class analytics — same structure as the Teacher / Class detail views */}
      {group.groupRotationAssignments.some((h) => h.historicalClassInstances.length > 0) && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-gray-400" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-gray-900">Class Analytics</h2>
          </div>
          {group.groupRotationAssignments
            .filter((h) => h.historicalClassInstances.length > 0)
            .map((h) => (
              <div key={h.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-500 mb-3">
                  Rotation {h.rotationNumber} - {h.carouselPosition.teacherClassAssignment.activityTemplate.name} ·{" "}
                  {h.carouselPosition.teacherClassAssignment.teacherProfile.firstName}{" "}
                  {h.carouselPosition.teacherClassAssignment.teacherProfile.lastName}
                </p>
                <ClassInstanceAnalyticsView
                  analyticsApiUrl={`/api/admin/classes/${h.historicalClassInstances[0].id}/analytics`}
                  historyApiUrlFor={(studentId) => `/api/admin/grades/${studentId}/${h.historicalClassInstances[0].id}`}
                  compact
                />
              </div>
            ))}
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
                {addSearch ? "No students match your search." : "All eligible students are already in this group."}
              </div>
            ) : (
              <ul role="list" className="divide-y divide-gray-100">
                {filteredAvailable.map((student) => (
                  <li key={student.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors">
                    <div className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-medium text-gray-600">{student.firstName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{student.firstName} {student.lastName}</p>
                      <p className="text-xs text-gray-500 truncate">{student.email}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleAddMember(student)} disabled={addLoading} aria-label={`Add ${student.firstName} ${student.lastName}`}>
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
            Remove <strong>{removeTarget?.firstName} {removeTarget?.lastName}</strong> from <strong>{group.name}</strong>? Their grade history is preserved.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removeLoading}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveMember} loading={removeLoading}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove group confirm */}
      <Dialog open={removeGroupOpen} onOpenChange={(o) => !o && setRemoveGroupOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Remove group
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            Remove <strong>{group.name}</strong>? It will no longer appear in active rotations or new
            carousel assignments, but its members and grade history are preserved. You can restore it
            at any time.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveGroupOpen(false)} disabled={groupActionLoading}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleToggleGroupActive(false)} loading={groupActionLoading}>Remove group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent delete confirm */}
      <Dialog open={deleteGroupOpen} onOpenChange={(o) => { if (!o) { setDeleteGroupOpen(false); setDeleteConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Permanently delete group
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              This permanently deletes <strong>{group.name}</strong> and cannot be undone. Only groups
              with no rotation or grade history can be deleted this way - groups with real history
              must stay archived instead.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="delete-group-confirm">
                Type <strong className="font-mono">{group.name}</strong> to confirm
              </Label>
              <Input
                id="delete-group-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteGroupOpen(false); setDeleteConfirmText(""); }} disabled={deleteLoading}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGroup}
              disabled={deleteConfirmText !== group.name}
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
