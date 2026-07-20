import { AuditAction, Prisma, Role } from '@prisma/client'
import { db } from '@/lib/db'

// Re-export so callers can import AuditAction from here without needing @prisma/client directly
export { AuditAction }

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export interface CreateAuditLogParams {
  actorId?:     string
  actorRole?:   Role
  action:       AuditAction
  targetType:   string
  targetId?:    string
  targetLabel?: string
  beforeValue?: Record<string, unknown> | null
  afterValue?:  Record<string, unknown> | null
  reason?:      string
  ipAddress?:   string
  userAgent?:   string
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId:     params.actorId     ?? null,
        actorRole:   params.actorRole   ?? null,
        action:      params.action,
        targetType:  params.targetType,
        targetId:    params.targetId    ?? null,
        targetLabel: params.targetLabel ?? null,
        beforeValue: (params.beforeValue ?? undefined) as Prisma.InputJsonValue | undefined,
        afterValue:  (params.afterValue  ?? undefined) as Prisma.InputJsonValue | undefined,
        reason:      params.reason      ?? null,
        ipAddress:   params.ipAddress   ?? null,
        userAgent:   params.userAgent   ?? null,
      },
    })
  } catch (err) {
    // Audit failures must never crash the main request path
    console.error('[audit] Failed to write audit log:', err)
  }
}

// ---------------------------------------------------------------------------
// Typed helper: grade change
// ---------------------------------------------------------------------------

export async function auditGradeChange(opts: {
  actorId:                  string
  actorRole:                Role
  studentProfileId:         string
  historicalClassInstanceId: string
  standardNumber:           number
  before:                   Record<string, unknown> | null
  after:                    Record<string, unknown>
  ipAddress?:               string
  userAgent?:               string
}): Promise<void> {
  await createAuditLog({
    actorId:     opts.actorId,
    actorRole:   opts.actorRole,
    action:      AuditAction.TEACHER_ASSESSMENT_UPDATED,
    targetType:  'TeacherAssessment',
    targetId:    opts.studentProfileId,
    targetLabel: `Standard ${opts.standardNumber} — student ${opts.studentProfileId} — instance ${opts.historicalClassInstanceId}`,
    beforeValue: opts.before,
    afterValue:  opts.after,
    ipAddress:   opts.ipAddress,
    userAgent:   opts.userAgent,
  })
}

// ---------------------------------------------------------------------------
// Typed helper: rotation
// ---------------------------------------------------------------------------

export async function auditRotation(opts: {
  actorId:        string
  actorRole:      Role
  carouselPlanId: string
  planName:       string
  action:         typeof AuditAction.ROTATION_ADVANCED | typeof AuditAction.ROTATION_REVERSED
  notes?:         string
  ipAddress?:     string
  userAgent?:     string
}): Promise<void> {
  await createAuditLog({
    actorId:     opts.actorId,
    actorRole:   opts.actorRole,
    action:      opts.action,
    targetType:  'CarouselPlan',
    targetId:    opts.carouselPlanId,
    targetLabel: opts.planName,
    reason:      opts.notes,
    ipAddress:   opts.ipAddress,
    userAgent:   opts.userAgent,
  })
}

// ---------------------------------------------------------------------------
// Typed helper: approval / rejection
// ---------------------------------------------------------------------------

export async function auditApproval(opts: {
  actorId:       string
  actorRole:     Role
  targetUserId:  string
  targetEmail:   string
  approved:      boolean
  reason?:       string
  afterValue?:   Record<string, unknown>
  ipAddress?:    string
  userAgent?:    string
}): Promise<void> {
  await createAuditLog({
    actorId:     opts.actorId,
    actorRole:   opts.actorRole,
    action:      opts.approved
                   ? AuditAction.SIGNUP_REQUEST_APPROVED
                   : AuditAction.SIGNUP_REQUEST_REJECTED,
    targetType:  'User',
    targetId:    opts.targetUserId,
    targetLabel: opts.targetEmail,
    reason:      opts.reason,
    afterValue:  opts.afterValue,
    ipAddress:   opts.ipAddress,
    userAgent:   opts.userAgent,
  })
}

// ---------------------------------------------------------------------------
// Typed helper: authentication events
// ---------------------------------------------------------------------------

export async function auditLogin(opts: {
  actorId?:   string
  actorRole?: Role
  email:      string
  success:    boolean
  ipAddress?: string
  userAgent?: string
}): Promise<void> {
  await createAuditLog({
    actorId:     opts.actorId,
    actorRole:   opts.actorRole,
    action:      opts.success ? AuditAction.USER_LOGIN : AuditAction.USER_LOGIN_FAILED,
    targetType:  'User',
    targetLabel: opts.email,
    ipAddress:   opts.ipAddress,
    userAgent:   opts.userAgent,
  })
}

// ---------------------------------------------------------------------------
// Typed helper: class instance lock / reopen
// ---------------------------------------------------------------------------

export async function auditClassInstance(opts: {
  actorId:                  string
  actorRole:                Role
  historicalClassInstanceId: string
  action:                   typeof AuditAction.CLASS_INSTANCE_LOCKED | typeof AuditAction.CLASS_INSTANCE_REOPENED
  reason?:                  string
  ipAddress?:               string
  userAgent?:               string
}): Promise<void> {
  await createAuditLog({
    actorId:     opts.actorId,
    actorRole:   opts.actorRole,
    action:      opts.action,
    targetType:  'HistoricalClassInstance',
    targetId:    opts.historicalClassInstanceId,
    reason:      opts.reason,
    ipAddress:   opts.ipAddress,
    userAgent:   opts.userAgent,
  })
}

// ---------------------------------------------------------------------------
// Typed helper: regrade grant open / close
// ---------------------------------------------------------------------------

export async function auditRegradeGrant(opts: {
  actorId:                  string
  actorRole:                Role
  grantId:                  string
  historicalClassInstanceId: string
  action:                   'OPENED' | 'CLOSED' | 'BULK_OPENED' | 'BULK_CLOSED'
  reason?:                  string
  teacherRegradeEnabled?:   boolean
  studentCount?:            number
  ipAddress?:               string
  userAgent?:               string
}): Promise<void> {
  const actionMap = {
    OPENED: AuditAction.REGRADE_GRANT_OPENED,
    CLOSED: AuditAction.REGRADE_GRANT_CLOSED,
    BULK_OPENED: AuditAction.REGRADE_GRANT_BULK_OPENED,
    BULK_CLOSED: AuditAction.REGRADE_GRANT_BULK_CLOSED,
  } as const

  const instance = await db.historicalClassInstance.findUnique({
    where: { id: opts.historicalClassInstanceId },
    select: {
      studentGroup: { select: { name: true } },
      teacherClassAssignment: { select: { activityTemplate: { select: { name: true } } } },
    },
  })
  const targetLabel = instance
    ? `${instance.teacherClassAssignment.activityTemplate.name} — ${instance.studentGroup.name}`
    : undefined

  await createAuditLog({
    actorId:     opts.actorId,
    actorRole:   opts.actorRole,
    action:      actionMap[opts.action],
    targetType:  'ClassRegradeGrant',
    targetId:    opts.grantId,
    targetLabel,
    reason:      opts.reason,
    afterValue:
      opts.teacherRegradeEnabled !== undefined || opts.studentCount !== undefined
        ? { historicalClassInstanceId: opts.historicalClassInstanceId, teacherRegradeEnabled: opts.teacherRegradeEnabled, studentCount: opts.studentCount }
        : undefined,
    ipAddress:   opts.ipAddress,
    userAgent:   opts.userAgent,
  })
}

// ---------------------------------------------------------------------------
// Typed helper: student submission
// ---------------------------------------------------------------------------

export async function auditSubmission(opts: {
  actorId:                  string
  actorRole:                Role
  studentSubmissionId:      string
  studentProfileId:         string
  action:
    | typeof AuditAction.STUDENT_SUBMISSION_CREATED
    | typeof AuditAction.STUDENT_SUBMISSION_UPDATED
    | typeof AuditAction.STUDENT_SUBMISSION_SUBMITTED
  before?:                  Record<string, unknown> | null
  after?:                   Record<string, unknown>
  ipAddress?:               string
  userAgent?:               string
}): Promise<void> {
  await createAuditLog({
    actorId:     opts.actorId,
    actorRole:   opts.actorRole,
    action:      opts.action,
    targetType:  'StudentSubmission',
    targetId:    opts.studentSubmissionId,
    targetLabel: `student ${opts.studentProfileId}`,
    beforeValue: opts.before,
    afterValue:  opts.after,
    ipAddress:   opts.ipAddress,
    userAgent:   opts.userAgent,
  })
}

// ---------------------------------------------------------------------------
// Typed helper: ATL record
// ---------------------------------------------------------------------------

export async function auditAtlRecord(opts: {
  actorId:                  string
  actorRole:                Role
  studentProfileId:         string
  historicalClassInstanceId: string
  action:                   typeof AuditAction.ATL_RECORD_CREATED | typeof AuditAction.ATL_RECORD_UPDATED
  before?:                  Record<string, unknown> | null
  after?:                   Record<string, unknown>
  ipAddress?:               string
  userAgent?:               string
}): Promise<void> {
  await createAuditLog({
    actorId:     opts.actorId,
    actorRole:   opts.actorRole,
    action:      opts.action,
    targetType:  'ApproachToLearningRecord',
    targetId:    opts.studentProfileId,
    targetLabel: `student ${opts.studentProfileId} — instance ${opts.historicalClassInstanceId}`,
    beforeValue: opts.before,
    afterValue:  opts.after,
    ipAddress:   opts.ipAddress,
    userAgent:   opts.userAgent,
  })
}

// ---------------------------------------------------------------------------
// Typed helper: grade snapshot
// ---------------------------------------------------------------------------

export async function auditGradeSnapshot(opts: {
  actorId?:                 string
  actorRole?:               Role
  studentProfileId:         string
  historicalClassInstanceId: string
  snapshotId:               string
  ipAddress?:               string
  userAgent?:               string
}): Promise<void> {
  await createAuditLog({
    actorId:     opts.actorId,
    actorRole:   opts.actorRole,
    action:      AuditAction.GRADE_SNAPSHOT_CREATED,
    targetType:  'GradeCalculationSnapshot',
    targetId:    opts.snapshotId,
    targetLabel: `student ${opts.studentProfileId}`,
    ipAddress:   opts.ipAddress,
    userAgent:   opts.userAgent,
  })
}
