-- Carousel positions become per-group: add the FK now (nullable — existing
-- rows get backfilled by a follow-up data script before it's made required
-- in the next migration). The old plan-wide unique constraint is dropped
-- here since it no longer reflects the intended model; the new
-- (studentGroupId, positionOrder) constraint is added once backfilled.
ALTER TABLE "CarouselPosition" ADD COLUMN "studentGroupId" UUID;
ALTER TABLE "CarouselPosition" ADD CONSTRAINT "CarouselPosition_studentGroupId_fkey"
  FOREIGN KEY ("studentGroupId") REFERENCES "StudentGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CarouselPosition_studentGroupId_idx" ON "CarouselPosition"("studentGroupId");
DROP INDEX IF EXISTS "CarouselPosition_carouselPlanId_positionOrder_key";

-- RotationHistory: table has zero rows today (no rotation has ever been
-- recorded), so these can be added as NOT NULL directly with no backfill.
ALTER TABLE "RotationHistory" ADD COLUMN "studentGroupId" UUID NOT NULL;
ALTER TABLE "RotationHistory" ADD COLUMN "rotationNumber" INTEGER NOT NULL;
ALTER TABLE "RotationHistory" ADD COLUMN "fromActivityName" TEXT;
ALTER TABLE "RotationHistory" ADD COLUMN "toActivityName" TEXT NOT NULL;
ALTER TABLE "RotationHistory" ADD CONSTRAINT "RotationHistory_studentGroupId_fkey"
  FOREIGN KEY ("studentGroupId") REFERENCES "StudentGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "RotationHistory_studentGroupId_idx" ON "RotationHistory"("studentGroupId");
