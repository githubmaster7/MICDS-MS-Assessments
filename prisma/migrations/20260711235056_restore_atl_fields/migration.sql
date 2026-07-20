-- Restore the two teacher-only Approach to Learning ratings (no student
-- self-rating counterpart) confirmed against the dashboard mockup.
ALTER TABLE "ApproachToLearningRecord"
  ADD COLUMN "responsiblePrepared" DECIMAL(4,2),
  ADD COLUMN "respectfulWorks" DECIMAL(4,2);
