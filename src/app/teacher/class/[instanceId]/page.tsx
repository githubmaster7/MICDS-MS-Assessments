'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { ClassInstanceAnalyticsView, type ClassInstanceAnalyticsData } from '@/components/shared/ClassInstanceAnalyticsView'
import { PageHeader } from '@/components/layout/PageHeader'

export default function ClassAnalyticsPage() {
  const params = useParams<{ instanceId: string }>()
  const instanceId = params.instanceId
  const [header, setHeader] = useState<ClassInstanceAnalyticsData | null>(null)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        backHref={`/teacher/grade/students?instanceId=${instanceId}`}
        backLabel="Back to grading"
        title="Class Analytics"
        description={
          header && (
            <>
              {header.activityName} · {header.groupName}
            </>
          )
        }
      />

      <ClassInstanceAnalyticsView
        analyticsApiUrl={`/api/teacher/classes/${instanceId}/analytics`}
        historyApiUrlFor={(studentId) => `/api/teacher/grades/${studentId}/${instanceId}`}
        onLoad={setHeader}
      />
    </div>
  )
}
