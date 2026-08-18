import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role } from '@prisma/client'
import { z } from 'zod'
import { getGradeAndSubmissionHistory, type GradeHistoryEntry } from '@/lib/grading/history'

interface RouteParams {
  params: Promise<{ instanceId: string }>
}

const InstanceIdSchema = z.string().uuid()

/**
 * Read-only history for the CALLING student's own submissions and grade
 * changes on one class instance — never accepts a studentId, so there is no
 * ID-swap vector; ownership is always derived from the session.
 *
 * Feedback text inside gradeHistory is redacted per-standard unless the
 * teacher has marked that standard's feedback visible to the student —
 * the same isFeedbackStudentVisible gate every other student-facing route
 * (dashboard, class detail, submissions) already enforces, so history can't
 * leak a note the teacher intentionally kept private. Scores are never
 * redacted — students already see their own final scores everywhere.
 */
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.STUDENT) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { instanceId } = await params

  if (!InstanceIdSchema.safeParse(instanceId).success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const studentProfile = await db.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, groupMemberships: { select: { studentGroupId: true } } },
  })
  if (!studentProfile) return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 })

  const instance = await db.historicalClassInstance.findUnique({
    where: { id: instanceId },
    select: { studentGroupId: true },
  })
  if (!instance) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })

  const memberGroupIds = studentProfile.groupMemberships.map((m) => m.studentGroupId)
  if (!memberGroupIds.includes(instance.studentGroupId)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { assessments, gradeHistory, studentHistory, attemptCount } = await getGradeAndSubmissionHistory(
    studentProfile.id,
    instanceId,
  )

  const visibleByStandard: Record<1 | 2 | 3 | 4, boolean> = { 1: false, 2: false, 3: false, 4: false }
  for (const a of assessments) {
    const std = a.standardNumber as 1 | 2 | 3 | 4
    if (a.isFeedbackStudentVisible) visibleByStandard[std] = true
  }

  const redact = (entry: GradeHistoryEntry, visible: boolean): GradeHistoryEntry => {
    if (visible) return entry
    const strip = (v: unknown) =>
      v && typeof v === 'object' ? { ...(v as Record<string, unknown>), feedback: undefined } : v
    return { ...entry, beforeValue: strip(entry.beforeValue), afterValue: strip(entry.afterValue) }
  }

  const redactedGradeHistory: Record<1 | 2 | 3 | 4, GradeHistoryEntry[]> = {
    1: gradeHistory[1].map((e) => redact(e, visibleByStandard[1])),
    2: gradeHistory[2].map((e) => redact(e, visibleByStandard[2])),
    3: gradeHistory[3].map((e) => redact(e, visibleByStandard[3])),
    4: gradeHistory[4].map((e) => redact(e, visibleByStandard[4])),
  }

  return NextResponse.json({
    data: {
      gradeHistory: redactedGradeHistory,
      studentHistory,
      attemptCount,
    },
  })
}
