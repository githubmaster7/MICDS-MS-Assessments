"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClassInstanceAnalyticsView } from "@/components/shared/ClassInstanceAnalyticsView";
import { formatDate as fmtDate } from "@/lib/utils";
import { PageHeader } from "@/components/layout/PageHeader";

interface TeacherDetail {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  user: { email: string; status: string };
}

interface ClassRow {
  id: string;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED" | "LOCKED";
  group: { id: string; name: string; gradeLevel: string; gender: string };
  activity: { id: string; name: string };
  rotationNumber: number;
  startDate: string;
  endDate: string;
}

export default function TeacherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [teacher, setTeacher] = React.useState<TeacherDetail | null>(null);
  const [classes, setClasses] = React.useState<ClassRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/teachers/${id}`).then((r) => r.json()),
      fetch(`/api/admin/classes?teacherProfileId=${id}`).then((r) => r.json()),
    ])
      .then(([teacherData, classesData]) => {
        setTeacher(teacherData?.data ?? null);
        setClasses(classesData?.data ?? []);
      })
      .catch(() => {
        setTeacher(null);
        setClasses([]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-16">
          <AlertTriangle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Teacher not found.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/admin/teachers")}>
            Back to teachers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title={`${teacher.firstName} ${teacher.lastName}`}
        description={`${teacher.user.email} · Employee ID ${teacher.employeeId} · ${classes.length} ${classes.length === 1 ? "class" : "classes"} this year`}
        backHref="/admin/teachers"
        backLabel="Teachers & Classes"
      />

      {classes.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
          No classes assigned yet.
        </div>
      ) : (
        <div className="space-y-6">
          {classes.map((c) => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-medium text-gray-500 mb-3">
                <Link href={`/admin/groups/${c.group.id}`} className="hover:underline hover:text-primary-900">
                  {c.group.name}
                </Link>{" "}
                — Rotation {c.rotationNumber} · {c.activity.name} · {fmtDate(c.startDate)} – {fmtDate(c.endDate)} · {c.status}
              </p>
              <ClassInstanceAnalyticsView
                analyticsApiUrl={`/api/admin/classes/${c.id}/analytics`}
                historyApiUrlFor={(studentId) => `/api/admin/grades/${studentId}/${c.id}`}
                compact
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
