"use client";

import * as React from "react";
import {
  Plus,
  GraduationCap,
  Layers,
  Search,
  UserMinus,
  UserPlus,
  RotateCcw,
  ArrowLeftRight,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface ActivityTemplate {
  id: string;
  name: string;
  description: string | null;
  gender: "MALE" | "FEMALE" | null;
  gradeLevel: "GRADE_5" | "GRADE_6" | "GRADE_7" | "GRADE_8" | null;
  isActive: boolean;
  _count: { teacherClassAssignments: number };
}

interface Assignment {
  id: string;
  isActive: boolean;
  teacherProfile: { id: string; firstName: string; lastName: string };
  activityTemplate: { id: string; name: string; gender: string | null; gradeLevel: string | null };
  schoolYear: { id: string; name: string };
}

interface TeacherOption {
  id: string; // teacherProfileId
  firstName: string;
  lastName: string;
  email: string;
}

interface SchoolYear {
  id: string;
  name: string;
  isActive: boolean;
}

interface ReassignConflict {
  assignmentId: string;
  teacherName: string;
  activityName: string;
  yourActivityName: string;
}

const GRADE_LABELS: Record<string, string> = { GRADE_5: "5", GRADE_6: "6", GRADE_7: "7", GRADE_8: "8" };
const GENDER_LABELS: Record<string, string> = { MALE: "Boys", FEMALE: "Girls" };

function GenderBadge({ gender }: { gender: string | null }) {
  if (!gender) return <span className="text-xs text-gray-400">Any</span>;
  const map: Record<string, string> = {
    MALE: "bg-sky-50 text-sky-700 border-sky-100",
    FEMALE: "bg-pink-50 text-pink-700 border-pink-100",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${map[gender] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {GENDER_LABELS[gender] ?? gender}
    </span>
  );
}

export default function AdminTeachersPage() {
  const { toast } = useToast();

  const [activityTemplates, setActivityTemplates] = React.useState<ActivityTemplate[]>([]);
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [teachers, setTeachers] = React.useState<TeacherOption[]>([]);
  const [schoolYears, setSchoolYears] = React.useState<SchoolYear[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  const [createClassOpen, setCreateClassOpen] = React.useState(false);
  const [createClassLoading, setCreateClassLoading] = React.useState(false);
  const [classForm, setClassForm] = React.useState({ name: "", description: "", gender: "ANY", gradeLevel: "ANY" });
  const [classFormErrors, setClassFormErrors] = React.useState<Record<string, string>>({});

  const [assignOpen, setAssignOpen] = React.useState(false);
  const [assignLoading, setAssignLoading] = React.useState(false);
  const [assignForm, setAssignForm] = React.useState({ teacherProfileId: "", activityTemplateId: "", schoolYearId: "" });
  const [assignFormErrors, setAssignFormErrors] = React.useState<Record<string, string>>({});

  const [classReassignTarget, setClassReassignTarget] = React.useState<ActivityTemplate | null>(null);
  const [classReassignForm, setClassReassignForm] = React.useState({ gender: "ANY", gradeLevel: "ANY" });
  const [classReassignLoading, setClassReassignLoading] = React.useState(false);

  const [teacherReassignTarget, setTeacherReassignTarget] = React.useState<Assignment | null>(null);
  const [teacherReassignForm, setTeacherReassignForm] = React.useState({ teacherProfileId: "", activityTemplateId: "" });
  const [teacherReassignLoading, setTeacherReassignLoading] = React.useState(false);
  const [teacherReassignConflict, setTeacherReassignConflict] = React.useState<ReassignConflict | null>(null);

  const fetchAll = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/activity-templates").then((r) => r.json()),
      fetch("/api/admin/teacher-class-assignments").then((r) => r.json()),
      fetch("/api/admin/users?role=TEACHER&status=ACTIVE&pageSize=200").then((r) => r.json()),
      fetch("/api/admin/school-years").then((r) => r.json()),
    ])
      .then(([classesData, assignmentsData, usersData, yearsData]) => {
        setActivityTemplates(classesData?.data ?? []);
        setAssignments(assignmentsData?.data ?? []);
        const users: Array<{ teacherProfile?: { id: string; firstName: string; lastName: string }; email: string }> = usersData?.data ?? [];
        setTeachers(
          users
            .filter((u) => u.teacherProfile)
            .map((u) => ({ id: u.teacherProfile!.id, firstName: u.teacherProfile!.firstName, lastName: u.teacherProfile!.lastName, email: u.email }))
        );
        const years: SchoolYear[] = yearsData?.data ?? [];
        setSchoolYears(years);
        const defaultYear = years.find((y) => y.isActive) ?? years[0];
        if (defaultYear) setAssignForm((f) => ({ ...f, schoolYearId: f.schoolYearId || defaultYear.id }));
      })
      .catch(() => {
        setActivityTemplates([]);
        setAssignments([]);
        setTeachers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredClasses = activityTemplates.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const validateClassForm = () => {
    const errs: Record<string, string> = {};
    if (!classForm.name.trim()) errs.name = "Name is required";
    setClassFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateClass = async () => {
    if (!validateClassForm()) return;
    setCreateClassLoading(true);
    try {
      const res = await fetch("/api/admin/activity-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: classForm.name.trim(),
          description: classForm.description.trim() || undefined,
          gender: classForm.gender === "ANY" ? undefined : classForm.gender,
          gradeLevel: classForm.gradeLevel === "ANY" ? undefined : classForm.gradeLevel,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to create class");
      toast({ title: "Class added", description: `"${classForm.name}" was added.` });
      setCreateClassOpen(false);
      setClassForm({ name: "", description: "", gender: "ANY", gradeLevel: "ANY" });
      fetchAll();
    } catch (e) {
      toast({ title: "Failed to add class", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setCreateClassLoading(false);
    }
  };

  const handleToggleClassActive = async (cls: ActivityTemplate) => {
    try {
      const res = await fetch(`/api/admin/activity-templates/${cls.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !cls.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to update class");
      toast({ title: cls.isActive ? "Class removed" : "Class restored" });
      fetchAll();
    } catch (e) {
      toast({ title: "Failed to update class", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    }
  };

  const openClassReassign = (cls: ActivityTemplate) => {
    setClassReassignForm({ gender: cls.gender ?? "ANY", gradeLevel: cls.gradeLevel ?? "ANY" });
    setClassReassignTarget(cls);
  };

  const handleClassReassignSubmit = async () => {
    if (!classReassignTarget) return;
    setClassReassignLoading(true);
    try {
      const patchRes = await fetch(`/api/admin/activity-templates/${classReassignTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender: classReassignForm.gender === "ANY" ? null : classReassignForm.gender,
          gradeLevel: classReassignForm.gradeLevel === "ANY" ? null : classReassignForm.gradeLevel,
        }),
      });
      const patchData = await patchRes.json().catch(() => ({}));
      if (!patchRes.ok) throw new Error(patchData?.error ?? "Failed to update class.");

      toast({ title: "Class reassigned" });
      setClassReassignTarget(null);
      fetchAll();
    } catch (e) {
      toast({ title: "Failed to reassign class", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setClassReassignLoading(false);
    }
  };

  const validateAssignForm = () => {
    const errs: Record<string, string> = {};
    if (!assignForm.teacherProfileId) errs.teacherProfileId = "Teacher is required";
    if (!assignForm.activityTemplateId) errs.activityTemplateId = "Class is required";
    if (!assignForm.schoolYearId) errs.schoolYearId = "School year is required";
    setAssignFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateAssignment = async () => {
    if (!validateAssignForm()) return;
    setAssignLoading(true);
    try {
      const res = await fetch("/api/admin/teacher-class-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assignForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to assign teacher");
      toast({ title: "Teacher assigned" });
      setAssignOpen(false);
      setAssignForm((f) => ({ ...f, teacherProfileId: "", activityTemplateId: "" }));
      fetchAll();
    } catch (e) {
      toast({ title: "Failed to assign teacher", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setAssignLoading(false);
    }
  };

  const handleToggleAssignmentActive = async (assignment: Assignment) => {
    try {
      const res = await fetch(`/api/admin/teacher-class-assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !assignment.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to update assignment");
      toast({ title: assignment.isActive ? "Assignment removed" : "Assignment restored" });
      fetchAll();
    } catch (e) {
      toast({ title: "Failed to update assignment", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    }
  };

  const openTeacherReassign = (assignment: Assignment) => {
    setTeacherReassignForm({ teacherProfileId: assignment.teacherProfile.id, activityTemplateId: assignment.activityTemplate.id });
    setTeacherReassignConflict(null);
    setTeacherReassignTarget(assignment);
  };

  const submitTeacherReassign = async (resolveConflictWithAssignmentId?: string) => {
    if (!teacherReassignTarget) return;
    setTeacherReassignLoading(true);
    try {
      const res = await fetch(`/api/admin/teacher-class-assignments/${teacherReassignTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherProfileId: teacherReassignForm.teacherProfileId,
          activityTemplateId: teacherReassignForm.activityTemplateId,
          ...(resolveConflictWithAssignmentId ? { resolveConflictWithAssignmentId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data?.conflict) {
        setTeacherReassignConflict(data.conflict);
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? "Failed to reassign.");
      toast({ title: data?.data?.swapped ? "Classes swapped" : "Reassigned" });
      setTeacherReassignTarget(null);
      setTeacherReassignConflict(null);
      fetchAll();
    } catch (e) {
      toast({ title: "Failed to reassign", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setTeacherReassignLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Teachers &amp; Classes</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage the classes (activities) offered and which teachers are assigned to teach them.
        </p>
      </div>

      {/* Classes */}
      <section aria-labelledby="classes-heading" className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h2 id="classes-heading" className="text-sm font-semibold text-gray-700">Classes</h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
              <Input placeholder="Search classes…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm w-48" aria-label="Search classes" />
            </div>
          </div>
          <Button size="sm" onClick={() => setCreateClassOpen(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add class
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
                </div>
              ))}
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="py-12 text-center">
              <Layers className="h-7 w-7 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">{search ? "No classes match your search." : "No classes yet."}</p>
            </div>
          ) : (
            <ul role="list" className="divide-y divide-gray-100">
              {filteredClasses.map((cls) => (
                <li key={cls.id} className={`flex items-center gap-4 px-5 py-3.5 ${!cls.isActive ? "opacity-60" : ""}`}>
                  <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    <Layers className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{cls.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {cls.gradeLevel ? `Grade ${GRADE_LABELS[cls.gradeLevel]}` : "Any grade"}
                      {" · "}
                      {cls._count.teacherClassAssignments} active assignment{cls._count.teacherClassAssignments !== 1 ? "s" : ""}
                      {!cls.isActive && " · Removed"}
                    </p>
                  </div>
                  <GenderBadge gender={cls.gender} />
                  {cls.isActive && (
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => openClassReassign(cls)}>
                      <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                      Reassign
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={cls.isActive ? "ghost" : "outline"}
                    className="text-xs"
                    onClick={() => handleToggleClassActive(cls)}
                  >
                    {cls.isActive ? (
                      <>
                        <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                        Remove
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        Restore
                      </>
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Teacher assignments */}
      <section aria-labelledby="assignments-heading" className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 id="assignments-heading" className="text-sm font-semibold text-gray-700">Teacher Assignments</h2>
          <Button size="sm" onClick={() => setAssignOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Assign teacher
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Teacher</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Class</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">School year</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide sr-only">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full max-w-[100px]" /></td>
                      ))}
                    </tr>
                  ))
                ) : assignments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <GraduationCap className="h-7 w-7 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No teacher assignments yet.</p>
                    </td>
                  </tr>
                ) : (
                  assignments.map((a) => (
                    <tr key={a.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${!a.isActive ? "opacity-60" : ""}`}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.teacherProfile.firstName} {a.teacherProfile.lastName}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{a.activityTemplate.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{a.schoolYear.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${a.isActive ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          {a.isActive ? "Active" : "Removed"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                        {a.isActive && (
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => openTeacherReassign(a)}>
                            <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                            Reassign
                          </Button>
                        )}
                        <Button size="sm" variant={a.isActive ? "ghost" : "outline"} className="text-xs" onClick={() => handleToggleAssignmentActive(a)}>
                          {a.isActive ? "Remove" : "Restore"}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Create class dialog */}
      <Dialog open={createClassOpen} onOpenChange={(o) => !o && setCreateClassOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add class</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="class-name">Class name</Label>
              <Input
                id="class-name"
                placeholder="e.g. Basketball"
                value={classForm.name}
                onChange={(e) => { setClassForm((f) => ({ ...f, name: e.target.value })); if (classFormErrors.name) setClassFormErrors((fe) => ({ ...fe, name: "" })); }}
                error={!!classFormErrors.name}
              />
              {classFormErrors.name && <p className="text-xs text-red-600">{classFormErrors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="class-description">Description (optional)</Label>
              <Textarea id="class-description" value={classForm.description} onChange={(e) => setClassForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="class-grade">Grade level</Label>
                <Select value={classForm.gradeLevel} onValueChange={(v) => setClassForm((f) => ({ ...f, gradeLevel: v }))}>
                  <SelectTrigger id="class-grade"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">Any grade</SelectItem>
                    <SelectItem value="GRADE_5">Grade 5</SelectItem>
                    <SelectItem value="GRADE_6">Grade 6</SelectItem>
                    <SelectItem value="GRADE_7">Grade 7</SelectItem>
                    <SelectItem value="GRADE_8">Grade 8</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="class-gender">Gender</Label>
                <Select value={classForm.gender} onValueChange={(v) => setClassForm((f) => ({ ...f, gender: v }))}>
                  <SelectTrigger id="class-gender"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">Any</SelectItem>
                    <SelectItem value="MALE">Boys</SelectItem>
                    <SelectItem value="FEMALE">Girls</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateClassOpen(false)} disabled={createClassLoading}>Cancel</Button>
            <Button onClick={handleCreateClass} loading={createClassLoading}>Add class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign teacher dialog */}
      <Dialog open={assignOpen} onOpenChange={(o) => !o && setAssignOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign teacher to a class</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="assign-teacher">Teacher</Label>
              <Select value={assignForm.teacherProfileId} onValueChange={(v) => { setAssignForm((f) => ({ ...f, teacherProfileId: v })); if (assignFormErrors.teacherProfileId) setAssignFormErrors((fe) => ({ ...fe, teacherProfileId: "" })); }}>
                <SelectTrigger id="assign-teacher"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
              {assignFormErrors.teacherProfileId && <p className="text-xs text-red-600">{assignFormErrors.teacherProfileId}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assign-class">Class</Label>
              <Select value={assignForm.activityTemplateId} onValueChange={(v) => { setAssignForm((f) => ({ ...f, activityTemplateId: v })); if (assignFormErrors.activityTemplateId) setAssignFormErrors((fe) => ({ ...fe, activityTemplateId: "" })); }}>
                <SelectTrigger id="assign-class"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {activityTemplates.filter((c) => c.isActive).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {assignFormErrors.activityTemplateId && <p className="text-xs text-red-600">{assignFormErrors.activityTemplateId}</p>}
            </div>
            {schoolYears.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="assign-year">School year</Label>
                <Select value={assignForm.schoolYearId} onValueChange={(v) => setAssignForm((f) => ({ ...f, schoolYearId: v }))}>
                  <SelectTrigger id="assign-year"><SelectValue placeholder="Select school year" /></SelectTrigger>
                  <SelectContent>
                    {schoolYears.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {assignFormErrors.schoolYearId && <p className="text-xs text-red-600">{assignFormErrors.schoolYearId}</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={assignLoading}>Cancel</Button>
            <Button onClick={handleCreateAssignment} loading={assignLoading}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign class dialog */}
      <Dialog open={!!classReassignTarget} onOpenChange={(o) => !o && setClassReassignTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reassign {classReassignTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="reassign-class-grade">Grade level</Label>
                <Select value={classReassignForm.gradeLevel} onValueChange={(v) => setClassReassignForm((f) => ({ ...f, gradeLevel: v }))}>
                  <SelectTrigger id="reassign-class-grade"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">Any grade</SelectItem>
                    <SelectItem value="GRADE_5">Grade 5</SelectItem>
                    <SelectItem value="GRADE_6">Grade 6</SelectItem>
                    <SelectItem value="GRADE_7">Grade 7</SelectItem>
                    <SelectItem value="GRADE_8">Grade 8</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reassign-class-gender">Gender</Label>
                <Select value={classReassignForm.gender} onValueChange={(v) => setClassReassignForm((f) => ({ ...f, gender: v }))}>
                  <SelectTrigger id="reassign-class-gender"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">Any</SelectItem>
                    <SelectItem value="MALE">Boys</SelectItem>
                    <SelectItem value="FEMALE">Girls</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              To change which group is currently in this class, or its position in a group's
              rotation order, use the Carousel &amp; Rotations page instead.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassReassignTarget(null)} disabled={classReassignLoading}>Cancel</Button>
            <Button onClick={handleClassReassignSubmit} loading={classReassignLoading}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign teacher assignment dialog */}
      <Dialog open={!!teacherReassignTarget} onOpenChange={(o) => { if (!o) { setTeacherReassignTarget(null); setTeacherReassignConflict(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reassign</DialogTitle></DialogHeader>
          {teacherReassignConflict ? (
            <div className="space-y-4 py-2">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  <strong>{teacherReassignConflict.activityName}</strong> is already assigned to{" "}
                  <strong>{teacherReassignConflict.teacherName}</strong>. Swap so{" "}
                  <strong>{teacherReassignConflict.teacherName}</strong> takes{" "}
                  <strong>{teacherReassignConflict.yourActivityName}</strong> instead, and this
                  assignment takes <strong>{teacherReassignConflict.activityName}</strong>?
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTeacherReassignConflict(null)} disabled={teacherReassignLoading}>Cancel</Button>
                <Button onClick={() => submitTeacherReassign(teacherReassignConflict.assignmentId)} loading={teacherReassignLoading}>
                  <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                  Swap classes
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="reassign-teacher-select">Teacher</Label>
                  <Select value={teacherReassignForm.teacherProfileId} onValueChange={(v) => setTeacherReassignForm((f) => ({ ...f, teacherProfileId: v }))}>
                    <SelectTrigger id="reassign-teacher-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reassign-teacher-class">Class</Label>
                  <Select value={teacherReassignForm.activityTemplateId} onValueChange={(v) => setTeacherReassignForm((f) => ({ ...f, activityTemplateId: v }))}>
                    <SelectTrigger id="reassign-teacher-class"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {activityTemplates.filter((c) => c.isActive).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-gray-400">
                  If only the teacher changes, the class keeps its place in the rotation order.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTeacherReassignTarget(null)} disabled={teacherReassignLoading}>Cancel</Button>
                <Button onClick={() => submitTeacherReassign()} loading={teacherReassignLoading}>Save changes</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
