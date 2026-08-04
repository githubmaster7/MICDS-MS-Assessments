-- Student self-score on a Standard 2/3 concept question. Informational only
-- — displayed on both student and teacher views, but the teacher's
-- TeacherPromptScore always wins for grade calculation.
CREATE TABLE "StudentPromptRating" (
    "id" UUID NOT NULL,
    "studentSubmissionId" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,
    "promptDefinitionId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "ratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPromptRating_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentPromptRating_studentSubmissionId_idx" ON "StudentPromptRating"("studentSubmissionId");

CREATE INDEX "StudentPromptRating_studentProfileId_idx" ON "StudentPromptRating"("studentProfileId");

CREATE INDEX "StudentPromptRating_promptDefinitionId_idx" ON "StudentPromptRating"("promptDefinitionId");

CREATE UNIQUE INDEX "StudentPromptRating_studentSubmissionId_promptDefinitionId_key" ON "StudentPromptRating"("studentSubmissionId", "promptDefinitionId");

ALTER TABLE "StudentPromptRating" ADD CONSTRAINT "StudentPromptRating_studentSubmissionId_fkey" FOREIGN KEY ("studentSubmissionId") REFERENCES "StudentSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentPromptRating" ADD CONSTRAINT "StudentPromptRating_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentPromptRating" ADD CONSTRAINT "StudentPromptRating_promptDefinitionId_fkey" FOREIGN KEY ("promptDefinitionId") REFERENCES "PromptDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
