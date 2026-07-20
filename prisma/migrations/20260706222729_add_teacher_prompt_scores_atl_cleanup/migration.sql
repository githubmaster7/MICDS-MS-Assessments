-- Approach to Learning: drop fields that don't exist in the real rubric
-- (responsiblePrepared, respectfulWorks), and make the two remaining rated
-- fields + calculatedScore nullable since teacher/student set them
-- independently and asynchronously.
ALTER TABLE "ApproachToLearningRecord"
  DROP COLUMN "respectfulWorks",
  DROP COLUMN "responsiblePrepared",
  ALTER COLUMN "effortTeacherScore" DROP NOT NULL,
  ALTER COLUMN "effortStudentScore" DROP NOT NULL,
  ALTER COLUMN "calculatedScore" DROP NOT NULL;

-- Per-question teacher score for Standard 2/3/4 concept questions.
CREATE TABLE "TeacherPromptScore" (
    "id" UUID NOT NULL,
    "teacherAssessmentId" UUID NOT NULL,
    "promptDefinitionId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherPromptScore_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeacherPromptScore_teacherAssessmentId_idx" ON "TeacherPromptScore"("teacherAssessmentId");

CREATE INDEX "TeacherPromptScore_promptDefinitionId_idx" ON "TeacherPromptScore"("promptDefinitionId");

CREATE UNIQUE INDEX "TeacherPromptScore_teacherAssessmentId_promptDefinitionId_key" ON "TeacherPromptScore"("teacherAssessmentId", "promptDefinitionId");

ALTER TABLE "TeacherPromptScore" ADD CONSTRAINT "TeacherPromptScore_teacherAssessmentId_fkey" FOREIGN KEY ("teacherAssessmentId") REFERENCES "TeacherAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeacherPromptScore" ADD CONSTRAINT "TeacherPromptScore_promptDefinitionId_fkey" FOREIGN KEY ("promptDefinitionId") REFERENCES "PromptDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
