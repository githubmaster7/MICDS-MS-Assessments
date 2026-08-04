-- All positions have been backfilled with an owning group by the data
-- migration script; make the column required and add the per-group
-- uniqueness constraint that replaces the old plan-wide one.
ALTER TABLE "CarouselPosition" ALTER COLUMN "studentGroupId" SET NOT NULL;
CREATE UNIQUE INDEX "CarouselPosition_studentGroupId_positionOrder_key" ON "CarouselPosition"("studentGroupId", "positionOrder");
