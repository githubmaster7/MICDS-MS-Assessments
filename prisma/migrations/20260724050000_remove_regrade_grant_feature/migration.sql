-- Remove the regrade-grant ("Reopen Grading" / "Lock Grading") feature
-- entirely. Once a class instance locks (on rotation), it now has no code
-- path back to an editable state — see canTeacherGrade / the student
-- submission routes, which check only HistoricalClassInstance.status.
DROP TABLE "ClassRegradeGrantStudent";
DROP TABLE "ClassRegradeGrant";

-- Dead columns from an even earlier, already-abandoned direct reopen-to-ACTIVE
-- design; never written by any current code path.
ALTER TABLE "HistoricalClassInstance" DROP CONSTRAINT "HistoricalClassInstance_reopenedBy_fkey";
ALTER TABLE "HistoricalClassInstance" DROP COLUMN "reopenedAt";
ALTER TABLE "HistoricalClassInstance" DROP COLUMN "reopenedBy";
ALTER TABLE "HistoricalClassInstance" DROP COLUMN "reopenReason";
