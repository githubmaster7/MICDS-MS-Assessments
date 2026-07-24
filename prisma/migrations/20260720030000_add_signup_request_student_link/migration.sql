-- Link a parent's signup request to the student(s) they claim as their children.
CREATE TABLE "SignupRequestStudentLink" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "signupRequestId"  UUID        NOT NULL,
  "studentProfileId" UUID        NOT NULL,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "SignupRequestStudentLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SignupRequestStudentLink_signupRequestId_studentProfileId_key"
  ON "SignupRequestStudentLink"("signupRequestId", "studentProfileId");
CREATE INDEX "SignupRequestStudentLink_signupRequestId_idx"  ON "SignupRequestStudentLink"("signupRequestId");
CREATE INDEX "SignupRequestStudentLink_studentProfileId_idx" ON "SignupRequestStudentLink"("studentProfileId");
ALTER TABLE "SignupRequestStudentLink"
  ADD CONSTRAINT "SignupRequestStudentLink_signupRequestId_fkey"
  FOREIGN KEY ("signupRequestId") REFERENCES "SignupRequest"("id") ON DELETE CASCADE;
ALTER TABLE "SignupRequestStudentLink"
  ADD CONSTRAINT "SignupRequestStudentLink_studentProfileId_fkey"
  FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE;
