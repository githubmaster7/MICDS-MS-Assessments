-- Admin-controlled reopening of a LOCKED class instance for specific
-- students' resubmission and/or the teacher's regrading, with no time
-- limit. Deliberately independent of HistoricalClassInstance.status, which
-- stays LOCKED throughout — avoids ever having two simultaneously ACTIVE
-- instances for the same group.
CREATE TABLE "ClassRegradeGrant" (
    "id" UUID NOT NULL,
    "historicalClassInstanceId" UUID NOT NULL,
    "teacherRegradeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "openedBy" UUID NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedBy" UUID,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ClassRegradeGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClassRegradeGrant_historicalClassInstanceId_idx" ON "ClassRegradeGrant"("historicalClassInstanceId");

CREATE INDEX "ClassRegradeGrant_closedAt_idx" ON "ClassRegradeGrant"("closedAt");

ALTER TABLE "ClassRegradeGrant" ADD CONSTRAINT "ClassRegradeGrant_historicalClassInstanceId_fkey" FOREIGN KEY ("historicalClassInstanceId") REFERENCES "HistoricalClassInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassRegradeGrant" ADD CONSTRAINT "ClassRegradeGrant_openedBy_fkey" FOREIGN KEY ("openedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClassRegradeGrant" ADD CONSTRAINT "ClassRegradeGrant_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Which specific students a grant covers for resubmission. Materialized at
-- grant-creation time (a frozen roster snapshot, not a live membership
-- query), matching this schema's existing "freeze what was true at this
-- moment" tables (RotationHistory, SubmissionHistoryEntry, GradeCalculationSnapshot).
CREATE TABLE "ClassRegradeGrantStudent" (
    "id" UUID NOT NULL,
    "grantId" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,

    CONSTRAINT "ClassRegradeGrantStudent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClassRegradeGrantStudent_studentProfileId_idx" ON "ClassRegradeGrantStudent"("studentProfileId");

CREATE UNIQUE INDEX "ClassRegradeGrantStudent_grantId_studentProfileId_key" ON "ClassRegradeGrantStudent"("grantId", "studentProfileId");

ALTER TABLE "ClassRegradeGrantStudent" ADD CONSTRAINT "ClassRegradeGrantStudent_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "ClassRegradeGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassRegradeGrantStudent" ADD CONSTRAINT "ClassRegradeGrantStudent_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- New audit actions for the regrade-grant feature.
ALTER TYPE "AuditAction" ADD VALUE 'REGRADE_GRANT_OPENED';
ALTER TYPE "AuditAction" ADD VALUE 'REGRADE_GRANT_CLOSED';
ALTER TYPE "AuditAction" ADD VALUE 'REGRADE_GRANT_BULK_OPENED';
