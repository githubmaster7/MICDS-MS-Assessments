-- A separate, always-editable answer box for when a teacher has directly
-- told a student (outside the app) to redo a written question as a
-- reassessment. Independent of responseText and of the submission's
-- SUBMITTED/REASSESSMENT_SUBMITTED status entirely.
ALTER TABLE "WrittenResponse" ADD COLUMN "reassessmentResponseText" TEXT;
