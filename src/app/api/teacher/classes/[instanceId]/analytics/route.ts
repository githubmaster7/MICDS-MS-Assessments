import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { Role } from '@prisma/client'
import { getClassStandardItemDistribution, getClassApproachToLearningSummary } from '@/lib/analytics/class-score-distribution'

interface RouteParams {
  params: Promise<{ instanceId: string }>
}

function toNum(d: { toNumber: () => number } | null | undefined): number | null {
  return d ? d.toNumber() : null
}

// Read-only group analytics for a single class instance: per-standard score
// distributions pooled across every student (byStudent breakdown), a
// class-wide Approach to Learning summary, and a per-student roster row
// (letter grade, per-standard scores, ATL ratings, submission/grading
// attempt counts for the two history buttons). Viewable even on a LOCKED
// instance — this is read-only, unlike the grading PUT routes.
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (session.user.role !== Role.TEACHER) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { instanceId } = await params

  const teacherProfile = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!teacherProfile) return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 404 })

  const instance = await db.historicalClassInstance.findUnique({
    where: { id: instanceId },
    select: {
      id: true,
      status: true,
      teacherClassAssignment: {
        select: { teacherProfileId: true, activityTemplate: { select: { name: true } } },
      },
      studentGroup: {
        select: {
          id: true,
          name: true,
          memberships: {
            where: { leftAt: null },
            select: { studentProfile: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
      },
    },
  })
  if (!instance) return NextResponse.json({ error: 'Class instance not found.' }, { status: 404 })
  if (instance.teacherClassAssignment.teacherProfileId !== teacherProfile.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const studentIds = instance.studentGroup.memberships.map((m) => m.studentProfile.id)

  const [distributions, atlSummary, snapshots, atlRecords, submissions] = await Promise.all([
    getClassStandardItemDistribution(instanceId),
    getClassApproachToLearningSummary(instanceId),
    db.gradeCalculationSnapshot.findMany({
      where: { historicalClassInstanceId: instanceId, studentProfileId: { in: studentIds } },
      orderBy: { calculatedAt: 'desc' },
    }),
    db.approachToLearningRecord.findMany({
      where: { historicalClassInstanceId: instanceId, studentProfileId: { in: studentIds } },
    }),
    db.studentSubmission.findMany({
      where: { historicalClassInstanceId: instanceId, studentProfileId: { in: studentIds } },
      select: { studentProfileId: true, standardNumber: true, latestAttemptNumber: true, status: true },
    }),
  ])

  // Latest snapshot per student (snapshots already ordered desc).
  const latestSnapshotByStudent = new Map<string, (typeof snapshots)[number]>()
  for (const s of snapshots) {
    if (!latestSnapshotByStudent.has(s.studentProfileId)) latestSnapshotByStudent.set(s.studentProfileId, s)
  }
  const atlByStudent = new Map(atlRecords.map((r) => [r.studentProfileId, r]))
  const submissionAttemptsByStudent = new Map<string, number>()
  for (const sub of submissions) {
    const prev = submissionAttemptsByStudent.get(sub.studentProfileId) ?? 0
    submissionAttemptsByStudent.set(sub.studentProfileId, prev + Math.max(0, sub.latestAttemptNumber - 1))
  }

  const roster = instance.studentGroup.memberships.map((m) => {
    const sp = m.studentProfile
    const snapshot = latestSnapshotByStudent.get(sp.id)
    const atl = atlByStudent.get(sp.id)
    return {
      studentProfileId: sp.id,
      studentName: `${sp.firstName} ${sp.lastName}`,
      letterGrade: snapshot?.letterGrade ?? null,
      standards: {
        1: toNum(snapshot?.standard1Score),
        2: toNum(snapshot?.standard2Score),
        3: toNum(snapshot?.standard3Score),
        4: toNum(snapshot?.standard4Score),
      },
      atl: {
        responsiblePrepared: toNum(atl?.responsiblePrepared),
        respectfulWorks: toNum(atl?.respectfulWorks),
        effortTeacherScore: toNum(atl?.effortTeacherScore),
      },
      resubmissionCount: submissionAttemptsByStudent.get(sp.id) ?? 0,
    }
  })

  return NextResponse.json({
    data: {
      groupName: instance.studentGroup.name,
      activityName: instance.teacherClassAssignment.activityTemplate.name,
      status: instance.status,
      distributions,
      atlSummary,
      roster,
    },
  })
}
