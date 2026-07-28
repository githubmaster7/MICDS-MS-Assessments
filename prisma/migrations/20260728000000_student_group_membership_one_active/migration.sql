-- Enforce "a student belongs to at most one active group at a time" at the
-- database level. The application already assumes this invariant (each
-- group rotates through its own class sequence independently, and per-class
-- grade snapshots are keyed by studentGroupId), but nothing previously
-- prevented an admin request (or two racing requests) from adding the same
-- student to a second group while still active in the first. A plain
-- @@unique([studentGroupId, studentProfileId]) only prevents duplicate rows
-- within the SAME group, so this is a separate partial index scoped to
-- leftAt IS NULL (i.e. currently-active memberships only) - a student may
-- still have many historical (leftAt NOT NULL) rows across groups.
CREATE UNIQUE INDEX "StudentGroupMembership_one_active_per_student"
ON "StudentGroupMembership" ("studentProfileId")
WHERE "leftAt" IS NULL;
