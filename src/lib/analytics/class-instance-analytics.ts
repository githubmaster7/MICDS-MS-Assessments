import { db } from '@/lib/db'
import { getClassStandardItemDistribution, getClassApproachToLearningSummary } from '@/lib/analytics/class-score-distribution'

function toNum(d: { toNumber: () => number } | null | undefined): number | null {
  return d ? d.toNumber() : null
}

export interface ClassInstanceRosterRow {
  studentProfileId: string
  studentName: string
  letterGrade: string | null
  standards: Record<1 | 2 | 3 | 4, number | null>
  atl: { responsiblePrepared: number | null; respectfulWorks: number | null; effortTeacherScore: number | null }
  resubmissionCount: number
}

export interface ClassInstanceAnalytics {
  groupId: string
  groupName: string
  activityName: string
  teacherProfileId: string
  teacherName: string
  status: string
  distributions: Awaited<ReturnType<typeof getClassStandardItemDistribution>>
  atlSummary: Awaited<ReturnType<typeof getClassApproachToLearningSummary>>
  roster: ClassInstanceRosterRow[]
}

/**
 * Single source of truth for one class instance's read-only analytics:
 * per-standard score distributions pooled across every student (byStudent
 * breakdown), a class-wide Approach to Learning summary, and a per-student
 * roster row (letter grade, per-standard scores, ATL ratings, resubmission
 * count). Used by the teacher's own Class Analytics page AND by the admin
 * Group/Teacher/Class detail views, so all three roles see identical
 * numbers for the same instance — never three divergent calculations.
 */
export async function getClassInstanceAnalytics(instanceId: string): Promise<ClassInstanceAnalytics | null> {
  const instance = await db.historicalClassInstance.findUnique({
    where: { id: instanceId },
    select: {
      id: true,
      status: true,
      teacherClassAssignment: {
        select: {
          teacherProfileId: true,
          activityTemplate: { select: { name: true } },
          teacherProfile: { select: { firstName: true, lastName: true } },
        },
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
  if (!instance) return null

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

  const roster: ClassInstanceRosterRow[] = instance.studentGroup.memberships.map((m) => {
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

  return {
    groupId: instance.studentGroup.id,
    groupName: instance.studentGroup.name,
    activityName: instance.teacherClassAssignment.activityTemplate.name,
    teacherProfileId: instance.teacherClassAssignment.teacherProfileId,
    teacherName: `${instance.teacherClassAssignment.teacherProfile.firstName} ${instance.teacherClassAssignment.teacherProfile.lastName}`,
    status: instance.status,
    distributions,
    atlSummary,
    roster,
  }
}
