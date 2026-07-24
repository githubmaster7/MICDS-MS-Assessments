"use client";

import * as React from "react";
import { Search, Users, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  gender: string;
  studentId: string;
  currentGroup: { id: string; name: string } | null;
  currentActivity: string | null;
  currentTeacher: string | null;
  overallAverage: string | number | null;
  letterGrade: string | null;
  standard1Score: string | number | null;
  standard2Score: string | number | null;
  standard3Score: string | number | null;
  standard4Score: string | number | null;
  hasGrade: boolean;
}

const GRADE_LABELS: Record<string, string> = {
  GRADE_5: "5th Grade",
  GRADE_6: "6th Grade",
  GRADE_7: "7th Grade",
  GRADE_8: "8th Grade",
};

const GRADE_BADGE: Record<string, string> = {
  A: "bg-emerald-50 text-emerald-700 border-emerald-100",
  "A-": "bg-emerald-50 text-emerald-700 border-emerald-100",
  "B+": "bg-blue-50 text-blue-700 border-blue-100",
  B: "bg-blue-50 text-blue-700 border-blue-100",
  "B-": "bg-blue-50 text-blue-700 border-blue-100",
  "C+": "bg-yellow-50 text-yellow-700 border-yellow-100",
  C: "bg-yellow-50 text-yellow-700 border-yellow-100",
  "C-": "bg-orange-50 text-orange-700 border-orange-100",
  "D+": "bg-orange-50 text-orange-700 border-orange-100",
  D: "bg-red-50 text-red-600 border-red-100",
  "D-": "bg-red-50 text-red-600 border-red-100",
  F: "bg-red-100 text-red-700 border-red-200",
};

function fmtScore(v: string | number | null) {
  return v === null ? "—" : Number(v).toFixed(1);
}

export default function AdminAllStudentsPage() {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [gradeLevel, setGradeLevel] = React.useState("ALL");
  const [gender, setGender] = React.useState("ALL");
  const [letterGrade, setLetterGrade] = React.useState("ALL");
  const [rows, setRows] = React.useState<StudentRow[]>([]);
  const [truncated, setTruncated] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchStudents = React.useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (gradeLevel !== "ALL") params.set("gradeLevel", gradeLevel);
    if (gender !== "ALL") params.set("gender", gender);
    if (letterGrade !== "ALL") params.set("letterGrade", letterGrade);

    fetch(`/api/admin/students?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        setRows(d?.data ?? []);
        setTruncated(!!d?.truncated);
      })
      .catch(() => setError("Failed to load students. Please try again."))
      .finally(() => setLoading(false));
  }, [debouncedSearch, gradeLevel, gender, letterGrade]);

  React.useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const hasFilters =
    debouncedSearch || gradeLevel !== "ALL" || gender !== "ALL" || letterGrade !== "ALL";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">All Students</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Read-only oversight across every student group. Grading happens in each teacher&apos;s
          current assignment, not here.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
          <Input
            placeholder="Search name or student ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
            aria-label="Search students"
          />
        </div>
        <Select value={gradeLevel} onValueChange={setGradeLevel}>
          <SelectTrigger className="w-32 h-8 text-sm" aria-label="Filter by grade level">
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All grades</SelectItem>
            <SelectItem value="GRADE_5">5th Grade</SelectItem>
            <SelectItem value="GRADE_6">6th Grade</SelectItem>
            <SelectItem value="GRADE_7">7th Grade</SelectItem>
            <SelectItem value="GRADE_8">8th Grade</SelectItem>
          </SelectContent>
        </Select>
        <Select value={gender} onValueChange={setGender}>
          <SelectTrigger className="w-28 h-8 text-sm" aria-label="Filter by gender">
            <SelectValue placeholder="Gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="MALE">Boys</SelectItem>
            <SelectItem value="FEMALE">Girls</SelectItem>
          </SelectContent>
        </Select>
        <Select value={letterGrade} onValueChange={setLetterGrade}>
          <SelectTrigger className="w-28 h-8 text-sm" aria-label="Filter by letter grade">
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any grade</SelectItem>
            {["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "D-", "F"].map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setGradeLevel("ALL"); setGender("ALL"); setLetterGrade("ALL"); }}
            className="text-xs text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400 tabular-nums">
          {rows.length.toLocaleString()} student{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {truncated && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Showing the first 500 matching students. Narrow your filters to see everyone.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Grade</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Group</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Class</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Teacher</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">S1</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">S2</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">S3</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">S4</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Grade</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full max-w-[80px]" /></td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <AlertTriangle className="h-8 w-8 text-red-300 mx-auto mb-2" />
                    <p className="text-sm text-red-500">{error}</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No students match these filters.</p>
                  </td>
                </tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{s.lastName}, {s.firstName}</p>
                      <p className="text-xs text-gray-400">{s.studentId}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{GRADE_LABELS[s.gradeLevel] ?? s.gradeLevel}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{s.currentGroup?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{s.currentActivity ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.currentTeacher ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-center tabular-nums text-gray-700">{fmtScore(s.standard1Score)}</td>
                    <td className="px-4 py-3 text-sm text-center tabular-nums text-gray-700">{fmtScore(s.standard2Score)}</td>
                    <td className="px-4 py-3 text-sm text-center tabular-nums text-gray-700">{fmtScore(s.standard3Score)}</td>
                    <td className="px-4 py-3 text-sm text-center tabular-nums text-gray-700">{fmtScore(s.standard4Score)}</td>
                    <td className="px-4 py-3 text-center">
                      {s.letterGrade ? (
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${GRADE_BADGE[s.letterGrade] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                          {s.letterGrade}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">No grade yet</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
