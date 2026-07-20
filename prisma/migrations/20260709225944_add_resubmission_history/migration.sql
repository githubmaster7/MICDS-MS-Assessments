-- Resubmission history: WrittenResponse now always holds the current/live
-- answer (no more isReassessment slot). Older attempts are frozen into
-- SubmissionHistoryEntry snapshots instead, so any number of resubmissions
-- can be tracked, not just one.

-- Drop any existing "reassessment" rows (isReassessment=true) — the
-- one-slot reassessment model is superseded by the history-snapshot model.
DELETE FROM "WrittenResponse" WHERE "isReassessment" = true;

DROP INDEX "WrittenResponse_studentSubmissionId_promptDefinitionId_isReassessment_key";

ALTER TABLE "WrittenResponse" DROP COLUMN "isReassessment";

CREATE UNIQUE INDEX "WrittenResponse_studentSubmissionId_promptDefinitionId_key" ON "WrittenResponse"("studentSubmissionId", "promptDefinitionId");

-- Track which attempt is currently "live" on a submission.
ALTER TABLE "StudentSubmission" ADD COLUMN "latestAttemptNumber" INTEGER NOT NULL DEFAULT 1;

-- Frozen snapshot of a past attempt.
CREATE TABLE "SubmissionHistoryEntry" (
    "id" UUID NOT NULL,
    "studentSubmissionId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "snapshotData" JSONB NOT NULL,

    CONSTRAINT "SubmissionHistoryEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubmissionHistoryEntry_studentSubmissionId_idx" ON "SubmissionHistoryEntry"("studentSubmissionId");

CREATE UNIQUE INDEX "SubmissionHistoryEntry_studentSubmissionId_attemptNumber_key" ON "SubmissionHistoryEntry"("studentSubmissionId", "attemptNumber");

ALTER TABLE "SubmissionHistoryEntry" ADD CONSTRAINT "SubmissionHistoryEntry_studentSubmissionId_fkey" FOREIGN KEY ("studentSubmissionId") REFERENCES "StudentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
