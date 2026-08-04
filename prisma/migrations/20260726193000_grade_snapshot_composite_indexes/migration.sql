-- Every call site that queries GradeCalculationSnapshot filters by
-- studentProfileId and/or historicalClassInstanceId (often as an IN-list)
-- and always orders by "calculatedAt" desc to get each student's latest
-- grade snapshot for a dashboard. A composite (filter column, calculatedAt)
-- index serves both the filter and the sort in a single index scan, so the
-- old standalone indexes are replaced rather than kept alongside these —
-- redundant indexes only add write overhead on a table that gets a new row
-- every time a grade is recalculated, which matters under concurrent load.

DROP INDEX "GradeCalculationSnapshot_studentProfileId_idx";
DROP INDEX "GradeCalculationSnapshot_historicalClassInstanceId_idx";
DROP INDEX "GradeCalculationSnapshot_calculatedAt_idx";

CREATE INDEX "GradeCalculationSnapshot_studentProfileId_calculatedAt_idx"
  ON "GradeCalculationSnapshot"("studentProfileId", "calculatedAt");

CREATE INDEX "GradeCalculationSnapshot_historicalClassInstanceId_calculatedAt_idx"
  ON "GradeCalculationSnapshot"("historicalClassInstanceId", "calculatedAt");
