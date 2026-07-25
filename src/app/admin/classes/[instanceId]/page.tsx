"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ClassInstanceAnalyticsView, type ClassInstanceAnalyticsData } from "@/components/shared/ClassInstanceAnalyticsView";
import { PageHeader } from "@/components/layout/PageHeader";

export default function AdminClassInstanceDetailPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const [header, setHeader] = React.useState<ClassInstanceAnalyticsData | null>(null);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title={header?.activityName ?? "Class"}
        description={header ? `${header.groupName} · ${header.teacherName} · ${header.status}` : undefined}
        backHref="/admin/classes"
        backLabel="All Classes"
      />

      <ClassInstanceAnalyticsView
        analyticsApiUrl={`/api/admin/classes/${instanceId}/analytics`}
        historyApiUrlFor={(studentId) => `/api/admin/grades/${studentId}/${instanceId}`}
        onLoad={setHeader}
      />
    </div>
  );
}
