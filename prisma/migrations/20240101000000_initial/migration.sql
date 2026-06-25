-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TEACHER', 'STUDENT', 'PARENT');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM (
  'PENDING_EMAIL_VERIFICATION',
  'PENDING_ADMIN_APPROVAL',
  'ACTIVE',
  'DEACTIVATED',
  'REJECTED'
);

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "GradeLevel" AS ENUM ('GRADE_6', 'GRADE_7', 'GRADE_8');

-- CreateEnum
CREATE TYPE "RotationStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED', 'LOCKED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM (
  'NOT_STARTED',
  'DRAFT',
  'SUBMITTED',
  'REASSESSMENT_SUBMITTED'
);

-- CreateEnum
CREATE TYPE "SkillType" AS ENUM ('FUNDAMENTAL', 'SPECIFIC');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM (
  'USER_REGISTERED',
  'USER_EMAIL_VERIFIED',
  'USER_LOGIN',
  'USER_LOGIN_FAILED',
  'USER_LOGOUT',
  'USER_PASSWORD_RESET_REQUESTED',
  'USER_PASSWORD_RESET',
  'SIGNUP_REQUEST_APPROVED',
  'SIGNUP_REQUEST_REJECTED',
  'USER_DEACTIVATED',
  'USER_REACTIVATED',
  'STUDENT_PROFILE_CREATED',
  'STUDENT_PROFILE_UPDATED',
  'TEACHER_PROFILE_CREATED',
  'TEACHER_PROFILE_UPDATED',
  'PARENT_PROFILE_CREATED',
  'PARENT_STUDENT_LINK_CREATED',
  'PARENT_STUDENT_LINK_REMOVED',
  'SCHOOL_YEAR_CREATED',
  'SCHOOL_YEAR_UPDATED',
  'TERM_CREATED',
  'TERM_UPDATED',
  'STUDENT_GROUP_CREATED',
  'STUDENT_GROUP_UPDATED',
  'STUDENT_GROUP_MEMBERSHIP_ADDED',
  'STUDENT_GROUP_MEMBERSHIP_REMOVED',
  'CAROUSEL_PLAN_CREATED',
  'CAROUSEL_PLAN_UPDATED',
  'ROTATION_ADVANCED',
  'ROTATION_REVERSED',
  'GROUP_ROTATION_ASSIGNED',
  'GROUP_ROTATION_UPDATED',
  'CLASS_INSTANCE_LOCKED',
  'CLASS_INSTANCE_REOPENED',
  'RUBRIC_VERSION_CREATED',
  'RUBRIC_VERSION_UPDATED',
  'SKILL_DEFINITION_CREATED',
  'SKILL_DEFINITION_UPDATED',
  'PROMPT_DEFINITION_CREATED',
  'PROMPT_DEFINITION_UPDATED',
  'STUDENT_SUBMISSION_CREATED',
  'STUDENT_SUBMISSION_UPDATED',
  'STUDENT_SUBMISSION_SUBMITTED',
  'WRITTEN_RESPONSE_SAVED',
  'SKILL_SELF_RATING_SAVED',
  'TEACHER_ASSESSMENT_CREATED',
  'TEACHER_ASSESSMENT_UPDATED',
  'TEACHER_SKILL_SCORE_SAVED',
  'TEACHER_STANDARD4_RATING_SAVED',
  'STUDENT_STANDARD4_SELF_RATING_SAVED',
  'ATL_RECORD_CREATED',
  'ATL_RECORD_UPDATED',
  'GRADE_SNAPSHOT_CREATED'
);

-- ---------------------------------------------------------------------------
-- Users & Auth
-- ---------------------------------------------------------------------------

CREATE TABLE "User" (
  "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
  "email"           TEXT        NOT NULL,
  "passwordHash"    TEXT        NOT NULL,
  "role"            "Role"      NOT NULL,
  "status"          "AccountStatus" NOT NULL DEFAULT 'PENDING_EMAIL_VERIFICATION',
  "emailVerifiedAt" TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx"  ON "User"("email");
CREATE INDEX "User_role_idx"   ON "User"("role");
CREATE INDEX "User_status_idx" ON "User"("status");

CREATE TABLE "EmailVerificationToken" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "userId"    UUID        NOT NULL,
  "token"     TEXT        NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt"    TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");
CREATE INDEX "EmailVerificationToken_token_idx"  ON "EmailVerificationToken"("token");
ALTER TABLE "EmailVerificationToken"
  ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

CREATE TABLE "PasswordResetToken" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "userId"    UUID        NOT NULL,
  "token"     TEXT        NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt"    TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_token_idx"  ON "PasswordResetToken"("token");
ALTER TABLE "PasswordResetToken"
  ADD CONSTRAINT "PasswordResetToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

CREATE TABLE "SignupRequest" (
  "id"            UUID            NOT NULL DEFAULT gen_random_uuid(),
  "userId"        UUID            NOT NULL,
  "requestedRole" "Role"          NOT NULL,
  "adminNote"     TEXT,
  "reviewedBy"    UUID,
  "reviewedAt"    TIMESTAMPTZ,
  "status"        "AccountStatus" NOT NULL DEFAULT 'PENDING_ADMIN_APPROVAL',
  "createdAt"     TIMESTAMPTZ     NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT "SignupRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SignupRequest_userId_key" ON "SignupRequest"("userId");
CREATE INDEX "SignupRequest_status_idx"     ON "SignupRequest"("status");
CREATE INDEX "SignupRequest_reviewedBy_idx" ON "SignupRequest"("reviewedBy");
ALTER TABLE "SignupRequest"
  ADD CONSTRAINT "SignupRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "SignupRequest"
  ADD CONSTRAINT "SignupRequest_reviewedBy_fkey"
  FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

CREATE TABLE "StudentProfile" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "userId"     UUID         NOT NULL,
  "firstName"  TEXT         NOT NULL,
  "lastName"   TEXT         NOT NULL,
  "gradeLevel" "GradeLevel" NOT NULL,
  "gender"     "Gender"     NOT NULL,
  "studentId"  TEXT         NOT NULL,
  "createdAt"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentProfile_userId_key"    ON "StudentProfile"("userId");
CREATE UNIQUE INDEX "StudentProfile_studentId_key" ON "StudentProfile"("studentId");
CREATE INDEX "StudentProfile_gradeLevel_idx" ON "StudentProfile"("gradeLevel");
CREATE INDEX "StudentProfile_gender_idx"     ON "StudentProfile"("gender");
CREATE INDEX "StudentProfile_studentId_idx"  ON "StudentProfile"("studentId");
ALTER TABLE "StudentProfile"
  ADD CONSTRAINT "StudentProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

CREATE TABLE "TeacherProfile" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "userId"     UUID        NOT NULL,
  "firstName"  TEXT        NOT NULL,
  "lastName"   TEXT        NOT NULL,
  "employeeId" TEXT        NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeacherProfile_userId_key"     ON "TeacherProfile"("userId");
CREATE UNIQUE INDEX "TeacherProfile_employeeId_key" ON "TeacherProfile"("employeeId");
CREATE INDEX "TeacherProfile_employeeId_idx" ON "TeacherProfile"("employeeId");
ALTER TABLE "TeacherProfile"
  ADD CONSTRAINT "TeacherProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

CREATE TABLE "ParentProfile" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "userId"    UUID        NOT NULL,
  "firstName" TEXT        NOT NULL,
  "lastName"  TEXT        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ParentProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ParentProfile_userId_key" ON "ParentProfile"("userId");
ALTER TABLE "ParentProfile"
  ADD CONSTRAINT "ParentProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

CREATE TABLE "ParentStudentLink" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "parentProfileId"  UUID        NOT NULL,
  "studentProfileId" UUID        NOT NULL,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdBy"        UUID        NOT NULL,
  CONSTRAINT "ParentStudentLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ParentStudentLink_parentProfileId_studentProfileId_key"
  ON "ParentStudentLink"("parentProfileId", "studentProfileId");
CREATE INDEX "ParentStudentLink_parentProfileId_idx"  ON "ParentStudentLink"("parentProfileId");
CREATE INDEX "ParentStudentLink_studentProfileId_idx" ON "ParentStudentLink"("studentProfileId");
ALTER TABLE "ParentStudentLink"
  ADD CONSTRAINT "ParentStudentLink_parentProfileId_fkey"
  FOREIGN KEY ("parentProfileId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE;
ALTER TABLE "ParentStudentLink"
  ADD CONSTRAINT "ParentStudentLink_studentProfileId_fkey"
  FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE;
ALTER TABLE "ParentStudentLink"
  ADD CONSTRAINT "ParentStudentLink_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- School Year / Term
-- ---------------------------------------------------------------------------

CREATE TABLE "SchoolYear" (
  "id"        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "name"      TEXT        NOT NULL,
  "startDate" DATE        NOT NULL,
  "endDate"   DATE        NOT NULL,
  "isActive"  BOOLEAN     NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "SchoolYear_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SchoolYear_name_key"     ON "SchoolYear"("name");
CREATE INDEX "SchoolYear_isActive_idx" ON "SchoolYear"("isActive");

CREATE TABLE "Term" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "schoolYearId" UUID        NOT NULL,
  "name"         TEXT        NOT NULL,
  "startDate"    DATE        NOT NULL,
  "endDate"      DATE        NOT NULL,
  "termNumber"   INTEGER     NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Term_schoolYearId_termNumber_key" ON "Term"("schoolYearId", "termNumber");
CREATE INDEX "Term_schoolYearId_idx" ON "Term"("schoolYearId");
ALTER TABLE "Term"
  ADD CONSTRAINT "Term_schoolYearId_fkey"
  FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Activity Templates
-- ---------------------------------------------------------------------------

CREATE TABLE "ActivityTemplate" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "name"        TEXT         NOT NULL,
  "description" TEXT,
  "gender"      "Gender",
  "gradeLevel"  "GradeLevel",
  "isActive"    BOOLEAN      NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "ActivityTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ActivityTemplate_name_gender_gradeLevel_key"
  ON "ActivityTemplate"("name", "gender", "gradeLevel");
CREATE INDEX "ActivityTemplate_isActive_idx"   ON "ActivityTemplate"("isActive");
CREATE INDEX "ActivityTemplate_gender_idx"     ON "ActivityTemplate"("gender");
CREATE INDEX "ActivityTemplate_gradeLevel_idx" ON "ActivityTemplate"("gradeLevel");

-- ---------------------------------------------------------------------------
-- Student Groups
-- ---------------------------------------------------------------------------

CREATE TABLE "StudentGroup" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "schoolYearId" UUID         NOT NULL,
  "name"         TEXT         NOT NULL,
  "gradeLevel"   "GradeLevel" NOT NULL,
  "gender"       "Gender"     NOT NULL,
  "description"  TEXT,
  "isActive"     BOOLEAN      NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "StudentGroup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentGroup_schoolYearId_name_key" ON "StudentGroup"("schoolYearId", "name");
CREATE INDEX "StudentGroup_schoolYearId_idx" ON "StudentGroup"("schoolYearId");
CREATE INDEX "StudentGroup_gradeLevel_idx"   ON "StudentGroup"("gradeLevel");
CREATE INDEX "StudentGroup_gender_idx"       ON "StudentGroup"("gender");
CREATE INDEX "StudentGroup_isActive_idx"     ON "StudentGroup"("isActive");
ALTER TABLE "StudentGroup"
  ADD CONSTRAINT "StudentGroup_schoolYearId_fkey"
  FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE;

CREATE TABLE "StudentGroupMembership" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "studentGroupId"   UUID        NOT NULL,
  "studentProfileId" UUID        NOT NULL,
  "joinedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "leftAt"           TIMESTAMPTZ,
  CONSTRAINT "StudentGroupMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentGroupMembership_studentGroupId_studentProfileId_key"
  ON "StudentGroupMembership"("studentGroupId", "studentProfileId");
CREATE INDEX "StudentGroupMembership_studentGroupId_idx"   ON "StudentGroupMembership"("studentGroupId");
CREATE INDEX "StudentGroupMembership_studentProfileId_idx" ON "StudentGroupMembership"("studentProfileId");
ALTER TABLE "StudentGroupMembership"
  ADD CONSTRAINT "StudentGroupMembership_studentGroupId_fkey"
  FOREIGN KEY ("studentGroupId") REFERENCES "StudentGroup"("id") ON DELETE CASCADE;
ALTER TABLE "StudentGroupMembership"
  ADD CONSTRAINT "StudentGroupMembership_studentProfileId_fkey"
  FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Teacher Class Assignments
-- ---------------------------------------------------------------------------

CREATE TABLE "TeacherClassAssignment" (
  "id"                 UUID        NOT NULL DEFAULT gen_random_uuid(),
  "teacherProfileId"   UUID        NOT NULL,
  "activityTemplateId" UUID        NOT NULL,
  "schoolYearId"       UUID        NOT NULL,
  "isActive"           BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "TeacherClassAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeacherClassAssignment_teacherProfileId_activityTemplateId_schoolYearId_key"
  ON "TeacherClassAssignment"("teacherProfileId", "activityTemplateId", "schoolYearId");
CREATE INDEX "TeacherClassAssignment_teacherProfileId_idx"   ON "TeacherClassAssignment"("teacherProfileId");
CREATE INDEX "TeacherClassAssignment_activityTemplateId_idx" ON "TeacherClassAssignment"("activityTemplateId");
CREATE INDEX "TeacherClassAssignment_schoolYearId_idx"       ON "TeacherClassAssignment"("schoolYearId");
CREATE INDEX "TeacherClassAssignment_isActive_idx"           ON "TeacherClassAssignment"("isActive");
ALTER TABLE "TeacherClassAssignment"
  ADD CONSTRAINT "TeacherClassAssignment_teacherProfileId_fkey"
  FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT;
ALTER TABLE "TeacherClassAssignment"
  ADD CONSTRAINT "TeacherClassAssignment_activityTemplateId_fkey"
  FOREIGN KEY ("activityTemplateId") REFERENCES "ActivityTemplate"("id") ON DELETE RESTRICT;
ALTER TABLE "TeacherClassAssignment"
  ADD CONSTRAINT "TeacherClassAssignment_schoolYearId_fkey"
  FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Carousel Plans / Positions
-- ---------------------------------------------------------------------------

CREATE TABLE "CarouselPlan" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "schoolYearId" UUID        NOT NULL,
  "name"         TEXT        NOT NULL,
  "isActive"     BOOLEAN     NOT NULL DEFAULT false,
  "createdBy"    UUID        NOT NULL,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "CarouselPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CarouselPlan_schoolYearId_name_key" ON "CarouselPlan"("schoolYearId", "name");
CREATE INDEX "CarouselPlan_schoolYearId_idx" ON "CarouselPlan"("schoolYearId");
CREATE INDEX "CarouselPlan_isActive_idx"     ON "CarouselPlan"("isActive");
ALTER TABLE "CarouselPlan"
  ADD CONSTRAINT "CarouselPlan_schoolYearId_fkey"
  FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE;
ALTER TABLE "CarouselPlan"
  ADD CONSTRAINT "CarouselPlan_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT;

CREATE TABLE "CarouselPosition" (
  "id"                      UUID    NOT NULL DEFAULT gen_random_uuid(),
  "carouselPlanId"          UUID    NOT NULL,
  "positionOrder"           INTEGER NOT NULL,
  "teacherClassAssignmentId" UUID   NOT NULL,
  CONSTRAINT "CarouselPosition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CarouselPosition_carouselPlanId_positionOrder_key"
  ON "CarouselPosition"("carouselPlanId", "positionOrder");
CREATE INDEX "CarouselPosition_carouselPlanId_idx"          ON "CarouselPosition"("carouselPlanId");
CREATE INDEX "CarouselPosition_teacherClassAssignmentId_idx" ON "CarouselPosition"("teacherClassAssignmentId");
ALTER TABLE "CarouselPosition"
  ADD CONSTRAINT "CarouselPosition_carouselPlanId_fkey"
  FOREIGN KEY ("carouselPlanId") REFERENCES "CarouselPlan"("id") ON DELETE CASCADE;
ALTER TABLE "CarouselPosition"
  ADD CONSTRAINT "CarouselPosition_teacherClassAssignmentId_fkey"
  FOREIGN KEY ("teacherClassAssignmentId") REFERENCES "TeacherClassAssignment"("id") ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- Group Rotation Assignments
-- ---------------------------------------------------------------------------

CREATE TABLE "GroupRotationAssignment" (
  "id"                 UUID             NOT NULL DEFAULT gen_random_uuid(),
  "schoolYearId"       UUID             NOT NULL,
  "studentGroupId"     UUID             NOT NULL,
  "carouselPositionId" UUID             NOT NULL,
  "startDate"          DATE             NOT NULL,
  "endDate"            DATE             NOT NULL,
  "status"             "RotationStatus" NOT NULL DEFAULT 'UPCOMING',
  "rotationNumber"     INTEGER          NOT NULL,
  "createdAt"          TIMESTAMPTZ      NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ      NOT NULL DEFAULT now(),
  CONSTRAINT "GroupRotationAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GroupRotationAssignment_studentGroupId_carouselPositionId_rotationNumber_key"
  ON "GroupRotationAssignment"("studentGroupId", "carouselPositionId", "rotationNumber");
CREATE INDEX "GroupRotationAssignment_schoolYearId_idx"       ON "GroupRotationAssignment"("schoolYearId");
CREATE INDEX "GroupRotationAssignment_studentGroupId_idx"     ON "GroupRotationAssignment"("studentGroupId");
CREATE INDEX "GroupRotationAssignment_carouselPositionId_idx" ON "GroupRotationAssignment"("carouselPositionId");
CREATE INDEX "GroupRotationAssignment_status_idx"             ON "GroupRotationAssignment"("status");
ALTER TABLE "GroupRotationAssignment"
  ADD CONSTRAINT "GroupRotationAssignment_schoolYearId_fkey"
  FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE;
ALTER TABLE "GroupRotationAssignment"
  ADD CONSTRAINT "GroupRotationAssignment_studentGroupId_fkey"
  FOREIGN KEY ("studentGroupId") REFERENCES "StudentGroup"("id") ON DELETE RESTRICT;
ALTER TABLE "GroupRotationAssignment"
  ADD CONSTRAINT "GroupRotationAssignment_carouselPositionId_fkey"
  FOREIGN KEY ("carouselPositionId") REFERENCES "CarouselPosition"("id") ON DELETE RESTRICT;

CREATE TABLE "RotationHistory" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "carouselPlanId" UUID        NOT NULL,
  "executedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "executedBy"     UUID        NOT NULL,
  "notes"          TEXT,
  "reversedAt"     TIMESTAMPTZ,
  "reversedBy"     UUID,
  "reversalReason" TEXT,
  CONSTRAINT "RotationHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RotationHistory_carouselPlanId_idx" ON "RotationHistory"("carouselPlanId");
CREATE INDEX "RotationHistory_executedBy_idx"     ON "RotationHistory"("executedBy");
ALTER TABLE "RotationHistory"
  ADD CONSTRAINT "RotationHistory_carouselPlanId_fkey"
  FOREIGN KEY ("carouselPlanId") REFERENCES "CarouselPlan"("id") ON DELETE RESTRICT;
ALTER TABLE "RotationHistory"
  ADD CONSTRAINT "RotationHistory_executedBy_fkey"
  FOREIGN KEY ("executedBy") REFERENCES "User"("id") ON DELETE RESTRICT;
ALTER TABLE "RotationHistory"
  ADD CONSTRAINT "RotationHistory_reversedBy_fkey"
  FOREIGN KEY ("reversedBy") REFERENCES "User"("id") ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Historical Class Instances
-- ---------------------------------------------------------------------------

CREATE TABLE "HistoricalClassInstance" (
  "id"                       UUID             NOT NULL DEFAULT gen_random_uuid(),
  "groupRotationAssignmentId" UUID             NOT NULL,
  "studentGroupId"           UUID             NOT NULL,
  "teacherClassAssignmentId"  UUID             NOT NULL,
  "schoolYearId"             UUID             NOT NULL,
  "termId"                   UUID,
  "status"                   "RotationStatus" NOT NULL DEFAULT 'UPCOMING',
  "lockedAt"                 TIMESTAMPTZ,
  "lockedBy"                 UUID,
  "reopenedAt"               TIMESTAMPTZ,
  "reopenedBy"               UUID,
  "reopenReason"             TEXT,
  "createdAt"                TIMESTAMPTZ      NOT NULL DEFAULT now(),
  "updatedAt"                TIMESTAMPTZ      NOT NULL DEFAULT now(),
  CONSTRAINT "HistoricalClassInstance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HistoricalClassInstance_groupRotationAssignmentId_studentGroupId_teacherClassAssignmentId_key"
  ON "HistoricalClassInstance"("groupRotationAssignmentId", "studentGroupId", "teacherClassAssignmentId");
CREATE INDEX "HistoricalClassInstance_schoolYearId_idx"             ON "HistoricalClassInstance"("schoolYearId");
CREATE INDEX "HistoricalClassInstance_studentGroupId_idx"           ON "HistoricalClassInstance"("studentGroupId");
CREATE INDEX "HistoricalClassInstance_teacherClassAssignmentId_idx" ON "HistoricalClassInstance"("teacherClassAssignmentId");
CREATE INDEX "HistoricalClassInstance_status_idx"                   ON "HistoricalClassInstance"("status");
CREATE INDEX "HistoricalClassInstance_termId_idx"                   ON "HistoricalClassInstance"("termId");
ALTER TABLE "HistoricalClassInstance"
  ADD CONSTRAINT "HistoricalClassInstance_groupRotationAssignmentId_fkey"
  FOREIGN KEY ("groupRotationAssignmentId") REFERENCES "GroupRotationAssignment"("id") ON DELETE RESTRICT;
ALTER TABLE "HistoricalClassInstance"
  ADD CONSTRAINT "HistoricalClassInstance_studentGroupId_fkey"
  FOREIGN KEY ("studentGroupId") REFERENCES "StudentGroup"("id") ON DELETE RESTRICT;
ALTER TABLE "HistoricalClassInstance"
  ADD CONSTRAINT "HistoricalClassInstance_teacherClassAssignmentId_fkey"
  FOREIGN KEY ("teacherClassAssignmentId") REFERENCES "TeacherClassAssignment"("id") ON DELETE RESTRICT;
ALTER TABLE "HistoricalClassInstance"
  ADD CONSTRAINT "HistoricalClassInstance_schoolYearId_fkey"
  FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE;
ALTER TABLE "HistoricalClassInstance"
  ADD CONSTRAINT "HistoricalClassInstance_termId_fkey"
  FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL;
ALTER TABLE "HistoricalClassInstance"
  ADD CONSTRAINT "HistoricalClassInstance_lockedBy_fkey"
  FOREIGN KEY ("lockedBy") REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "HistoricalClassInstance"
  ADD CONSTRAINT "HistoricalClassInstance_reopenedBy_fkey"
  FOREIGN KEY ("reopenedBy") REFERENCES "User"("id") ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Rubric Versions
-- ---------------------------------------------------------------------------

CREATE TABLE "RubricVersion" (
  "id"                 UUID        NOT NULL DEFAULT gen_random_uuid(),
  "activityTemplateId" UUID        NOT NULL,
  "standardNumber"     INTEGER     NOT NULL,
  "activityName"       TEXT        NOT NULL,
  "version"            INTEGER     NOT NULL DEFAULT 1,
  "isActive"           BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "RubricVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RubricVersion_activityTemplateId_standardNumber_version_key"
  ON "RubricVersion"("activityTemplateId", "standardNumber", "version");
CREATE INDEX "RubricVersion_activityTemplateId_idx" ON "RubricVersion"("activityTemplateId");
CREATE INDEX "RubricVersion_standardNumber_idx"     ON "RubricVersion"("standardNumber");
CREATE INDEX "RubricVersion_isActive_idx"           ON "RubricVersion"("isActive");
ALTER TABLE "RubricVersion"
  ADD CONSTRAINT "RubricVersion_activityTemplateId_fkey"
  FOREIGN KEY ("activityTemplateId") REFERENCES "ActivityTemplate"("id") ON DELETE RESTRICT;

CREATE TABLE "SkillDefinition" (
  "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
  "rubricVersionId" UUID        NOT NULL,
  "skillType"       "SkillType" NOT NULL,
  "skillName"       TEXT        NOT NULL,
  "displayOrder"    INTEGER     NOT NULL,
  "isActive"        BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "SkillDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SkillDefinition_rubricVersionId_displayOrder_key"
  ON "SkillDefinition"("rubricVersionId", "displayOrder");
CREATE INDEX "SkillDefinition_rubricVersionId_idx" ON "SkillDefinition"("rubricVersionId");
CREATE INDEX "SkillDefinition_skillType_idx"       ON "SkillDefinition"("skillType");
CREATE INDEX "SkillDefinition_isActive_idx"        ON "SkillDefinition"("isActive");
ALTER TABLE "SkillDefinition"
  ADD CONSTRAINT "SkillDefinition_rubricVersionId_fkey"
  FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE CASCADE;

CREATE TABLE "PromptDefinition" (
  "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
  "rubricVersionId" UUID        NOT NULL,
  "standardNumber"  INTEGER     NOT NULL,
  "promptText"      TEXT        NOT NULL,
  "displayOrder"    INTEGER     NOT NULL,
  "isActive"        BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PromptDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PromptDefinition_rubricVersionId_standardNumber_displayOrder_key"
  ON "PromptDefinition"("rubricVersionId", "standardNumber", "displayOrder");
CREATE INDEX "PromptDefinition_rubricVersionId_idx" ON "PromptDefinition"("rubricVersionId");
CREATE INDEX "PromptDefinition_standardNumber_idx"  ON "PromptDefinition"("standardNumber");
CREATE INDEX "PromptDefinition_isActive_idx"        ON "PromptDefinition"("isActive");
ALTER TABLE "PromptDefinition"
  ADD CONSTRAINT "PromptDefinition_rubricVersionId_fkey"
  FOREIGN KEY ("rubricVersionId") REFERENCES "RubricVersion"("id") ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Student Submissions
-- ---------------------------------------------------------------------------

CREATE TABLE "StudentSubmission" (
  "id"                        UUID               NOT NULL DEFAULT gen_random_uuid(),
  "studentProfileId"          UUID               NOT NULL,
  "historicalClassInstanceId" UUID               NOT NULL,
  "standardNumber"            INTEGER            NOT NULL,
  "status"                    "SubmissionStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "honorCodeAcknowledgedAt"   TIMESTAMPTZ,
  "honorCodeVersion"          TEXT,
  "submittedAt"               TIMESTAMPTZ,
  "reassessmentSubmittedAt"   TIMESTAMPTZ,
  "createdAt"                 TIMESTAMPTZ        NOT NULL DEFAULT now(),
  "updatedAt"                 TIMESTAMPTZ        NOT NULL DEFAULT now(),
  CONSTRAINT "StudentSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentSubmission_studentProfileId_historicalClassInstanceId_standardNumber_key"
  ON "StudentSubmission"("studentProfileId", "historicalClassInstanceId", "standardNumber");
CREATE INDEX "StudentSubmission_studentProfileId_idx"          ON "StudentSubmission"("studentProfileId");
CREATE INDEX "StudentSubmission_historicalClassInstanceId_idx" ON "StudentSubmission"("historicalClassInstanceId");
CREATE INDEX "StudentSubmission_status_idx"                    ON "StudentSubmission"("status");
CREATE INDEX "StudentSubmission_standardNumber_idx"            ON "StudentSubmission"("standardNumber");
ALTER TABLE "StudentSubmission"
  ADD CONSTRAINT "StudentSubmission_studentProfileId_fkey"
  FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT;
ALTER TABLE "StudentSubmission"
  ADD CONSTRAINT "StudentSubmission_historicalClassInstanceId_fkey"
  FOREIGN KEY ("historicalClassInstanceId") REFERENCES "HistoricalClassInstance"("id") ON DELETE RESTRICT;

CREATE TABLE "WrittenResponse" (
  "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  "studentSubmissionId" UUID        NOT NULL,
  "promptDefinitionId"  UUID        NOT NULL,
  "responseText"        TEXT        NOT NULL,
  "isReassessment"      BOOLEAN     NOT NULL DEFAULT false,
  "submittedAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "WrittenResponse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WrittenResponse_studentSubmissionId_promptDefinitionId_isReassessment_key"
  ON "WrittenResponse"("studentSubmissionId", "promptDefinitionId", "isReassessment");
CREATE INDEX "WrittenResponse_studentSubmissionId_idx" ON "WrittenResponse"("studentSubmissionId");
CREATE INDEX "WrittenResponse_promptDefinitionId_idx"  ON "WrittenResponse"("promptDefinitionId");
ALTER TABLE "WrittenResponse"
  ADD CONSTRAINT "WrittenResponse_studentSubmissionId_fkey"
  FOREIGN KEY ("studentSubmissionId") REFERENCES "StudentSubmission"("id") ON DELETE CASCADE;
ALTER TABLE "WrittenResponse"
  ADD CONSTRAINT "WrittenResponse_promptDefinitionId_fkey"
  FOREIGN KEY ("promptDefinitionId") REFERENCES "PromptDefinition"("id") ON DELETE RESTRICT;

CREATE TABLE "StudentSkillSelfRating" (
  "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  "studentSubmissionId" UUID        NOT NULL,
  "studentProfileId"    UUID        NOT NULL,
  "skillDefinitionId"   UUID        NOT NULL,
  "rating"              INTEGER     NOT NULL CHECK ("rating" BETWEEN 1 AND 4),
  "ratedAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "StudentSkillSelfRating_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentSkillSelfRating_studentSubmissionId_skillDefinitionId_key"
  ON "StudentSkillSelfRating"("studentSubmissionId", "skillDefinitionId");
CREATE INDEX "StudentSkillSelfRating_studentSubmissionId_idx" ON "StudentSkillSelfRating"("studentSubmissionId");
CREATE INDEX "StudentSkillSelfRating_studentProfileId_idx"    ON "StudentSkillSelfRating"("studentProfileId");
CREATE INDEX "StudentSkillSelfRating_skillDefinitionId_idx"   ON "StudentSkillSelfRating"("skillDefinitionId");
ALTER TABLE "StudentSkillSelfRating"
  ADD CONSTRAINT "StudentSkillSelfRating_studentSubmissionId_fkey"
  FOREIGN KEY ("studentSubmissionId") REFERENCES "StudentSubmission"("id") ON DELETE CASCADE;
ALTER TABLE "StudentSkillSelfRating"
  ADD CONSTRAINT "StudentSkillSelfRating_studentProfileId_fkey"
  FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT;
ALTER TABLE "StudentSkillSelfRating"
  ADD CONSTRAINT "StudentSkillSelfRating_skillDefinitionId_fkey"
  FOREIGN KEY ("skillDefinitionId") REFERENCES "SkillDefinition"("id") ON DELETE RESTRICT;

CREATE TABLE "StudentStandard4SelfRating" (
  "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  "studentSubmissionId" UUID        NOT NULL,
  "studentProfileId"    UUID        NOT NULL,
  "rating"              INTEGER     NOT NULL CHECK ("rating" BETWEEN 1 AND 4),
  "ratedAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "StudentStandard4SelfRating_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudentStandard4SelfRating_studentSubmissionId_key"
  ON "StudentStandard4SelfRating"("studentSubmissionId");
CREATE INDEX "StudentStandard4SelfRating_studentSubmissionId_idx" ON "StudentStandard4SelfRating"("studentSubmissionId");
CREATE INDEX "StudentStandard4SelfRating_studentProfileId_idx"    ON "StudentStandard4SelfRating"("studentProfileId");
ALTER TABLE "StudentStandard4SelfRating"
  ADD CONSTRAINT "StudentStandard4SelfRating_studentSubmissionId_fkey"
  FOREIGN KEY ("studentSubmissionId") REFERENCES "StudentSubmission"("id") ON DELETE CASCADE;
ALTER TABLE "StudentStandard4SelfRating"
  ADD CONSTRAINT "StudentStandard4SelfRating_studentProfileId_fkey"
  FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- Teacher Assessments
-- ---------------------------------------------------------------------------

CREATE TABLE "TeacherAssessment" (
  "id"                        UUID          NOT NULL DEFAULT gen_random_uuid(),
  "teacherProfileId"          UUID          NOT NULL,
  "historicalClassInstanceId" UUID          NOT NULL,
  "studentProfileId"          UUID          NOT NULL,
  "standardNumber"            INTEGER       NOT NULL,
  "score"                     DECIMAL(4,2),
  "feedback"                  TEXT,
  "isFeedbackStudentVisible"  BOOLEAN       NOT NULL DEFAULT false,
  "assessedAt"                TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "updatedAt"                 TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT "TeacherAssessment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeacherAssessment_teacherProfileId_historicalClassInstanceId_studentProfileId_standardNumber_key"
  ON "TeacherAssessment"("teacherProfileId", "historicalClassInstanceId", "studentProfileId", "standardNumber");
CREATE INDEX "TeacherAssessment_teacherProfileId_idx"          ON "TeacherAssessment"("teacherProfileId");
CREATE INDEX "TeacherAssessment_historicalClassInstanceId_idx" ON "TeacherAssessment"("historicalClassInstanceId");
CREATE INDEX "TeacherAssessment_studentProfileId_idx"          ON "TeacherAssessment"("studentProfileId");
CREATE INDEX "TeacherAssessment_standardNumber_idx"            ON "TeacherAssessment"("standardNumber");
ALTER TABLE "TeacherAssessment"
  ADD CONSTRAINT "TeacherAssessment_teacherProfileId_fkey"
  FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT;
ALTER TABLE "TeacherAssessment"
  ADD CONSTRAINT "TeacherAssessment_historicalClassInstanceId_fkey"
  FOREIGN KEY ("historicalClassInstanceId") REFERENCES "HistoricalClassInstance"("id") ON DELETE RESTRICT;
ALTER TABLE "TeacherAssessment"
  ADD CONSTRAINT "TeacherAssessment_studentProfileId_fkey"
  FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT;

CREATE TABLE "TeacherSkillScore" (
  "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  "teacherAssessmentId" UUID        NOT NULL,
  "skillDefinitionId"   UUID        NOT NULL,
  "score"               INTEGER     NOT NULL CHECK ("score" BETWEEN 1 AND 4),
  "scoredAt"            TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "TeacherSkillScore_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeacherSkillScore_teacherAssessmentId_skillDefinitionId_key"
  ON "TeacherSkillScore"("teacherAssessmentId", "skillDefinitionId");
CREATE INDEX "TeacherSkillScore_teacherAssessmentId_idx" ON "TeacherSkillScore"("teacherAssessmentId");
CREATE INDEX "TeacherSkillScore_skillDefinitionId_idx"   ON "TeacherSkillScore"("skillDefinitionId");
ALTER TABLE "TeacherSkillScore"
  ADD CONSTRAINT "TeacherSkillScore_teacherAssessmentId_fkey"
  FOREIGN KEY ("teacherAssessmentId") REFERENCES "TeacherAssessment"("id") ON DELETE CASCADE;
ALTER TABLE "TeacherSkillScore"
  ADD CONSTRAINT "TeacherSkillScore_skillDefinitionId_fkey"
  FOREIGN KEY ("skillDefinitionId") REFERENCES "SkillDefinition"("id") ON DELETE RESTRICT;

CREATE TABLE "TeacherStandard4Rating" (
  "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  "teacherAssessmentId" UUID        NOT NULL,
  "rating"              INTEGER     NOT NULL CHECK ("rating" BETWEEN 1 AND 4),
  "ratedAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "TeacherStandard4Rating_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TeacherStandard4Rating_teacherAssessmentId_key"
  ON "TeacherStandard4Rating"("teacherAssessmentId");
CREATE INDEX "TeacherStandard4Rating_teacherAssessmentId_idx" ON "TeacherStandard4Rating"("teacherAssessmentId");
ALTER TABLE "TeacherStandard4Rating"
  ADD CONSTRAINT "TeacherStandard4Rating_teacherAssessmentId_fkey"
  FOREIGN KEY ("teacherAssessmentId") REFERENCES "TeacherAssessment"("id") ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Approach to Learning
-- ---------------------------------------------------------------------------

CREATE TABLE "ApproachToLearningRecord" (
  "id"                        UUID          NOT NULL DEFAULT gen_random_uuid(),
  "studentProfileId"          UUID          NOT NULL,
  "historicalClassInstanceId" UUID          NOT NULL,
  "teacherProfileId"          UUID          NOT NULL,
  "responsiblePrepared"       DECIMAL(4,2)  NOT NULL,
  "respectfulWorks"           DECIMAL(4,2)  NOT NULL,
  "effortTeacherScore"        DECIMAL(4,2)  NOT NULL,
  "effortStudentScore"        DECIMAL(4,2)  NOT NULL,
  "daysLateUnprepared"        INTEGER       NOT NULL DEFAULT 0,
  "calculatedScore"           DECIMAL(5,2)  NOT NULL,
  "recordedAt"                TIMESTAMPTZ   NOT NULL DEFAULT now(),
  "updatedAt"                 TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT "ApproachToLearningRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApproachToLearningRecord_studentProfileId_historicalClassInstanceId_key"
  ON "ApproachToLearningRecord"("studentProfileId", "historicalClassInstanceId");
CREATE INDEX "ApproachToLearningRecord_studentProfileId_idx"          ON "ApproachToLearningRecord"("studentProfileId");
CREATE INDEX "ApproachToLearningRecord_historicalClassInstanceId_idx" ON "ApproachToLearningRecord"("historicalClassInstanceId");
CREATE INDEX "ApproachToLearningRecord_teacherProfileId_idx"          ON "ApproachToLearningRecord"("teacherProfileId");
ALTER TABLE "ApproachToLearningRecord"
  ADD CONSTRAINT "ApproachToLearningRecord_studentProfileId_fkey"
  FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT;
ALTER TABLE "ApproachToLearningRecord"
  ADD CONSTRAINT "ApproachToLearningRecord_historicalClassInstanceId_fkey"
  FOREIGN KEY ("historicalClassInstanceId") REFERENCES "HistoricalClassInstance"("id") ON DELETE RESTRICT;
ALTER TABLE "ApproachToLearningRecord"
  ADD CONSTRAINT "ApproachToLearningRecord_teacherProfileId_fkey"
  FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------
-- Grade Calculation Snapshots
-- ---------------------------------------------------------------------------

CREATE TABLE "GradeCalculationSnapshot" (
  "id"                        UUID         NOT NULL DEFAULT gen_random_uuid(),
  "studentProfileId"          UUID         NOT NULL,
  "historicalClassInstanceId" UUID         NOT NULL,
  "schoolYearId"              UUID         NOT NULL,
  "standard1Score"            DECIMAL(5,2),
  "standard2Score"            DECIMAL(5,2),
  "standard3Score"            DECIMAL(5,2),
  "standard4Score"            DECIMAL(5,2),
  "overallAverage"            DECIMAL(5,2),
  "letterGrade"               TEXT,
  "calculatedAt"              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "snapshotData"              JSONB,
  CONSTRAINT "GradeCalculationSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GradeCalculationSnapshot_studentProfileId_idx"          ON "GradeCalculationSnapshot"("studentProfileId");
CREATE INDEX "GradeCalculationSnapshot_historicalClassInstanceId_idx" ON "GradeCalculationSnapshot"("historicalClassInstanceId");
CREATE INDEX "GradeCalculationSnapshot_schoolYearId_idx"              ON "GradeCalculationSnapshot"("schoolYearId");
CREATE INDEX "GradeCalculationSnapshot_calculatedAt_idx"              ON "GradeCalculationSnapshot"("calculatedAt");
ALTER TABLE "GradeCalculationSnapshot"
  ADD CONSTRAINT "GradeCalculationSnapshot_studentProfileId_fkey"
  FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT;
ALTER TABLE "GradeCalculationSnapshot"
  ADD CONSTRAINT "GradeCalculationSnapshot_historicalClassInstanceId_fkey"
  FOREIGN KEY ("historicalClassInstanceId") REFERENCES "HistoricalClassInstance"("id") ON DELETE RESTRICT;
ALTER TABLE "GradeCalculationSnapshot"
  ADD CONSTRAINT "GradeCalculationSnapshot_schoolYearId_fkey"
  FOREIGN KEY ("schoolYearId") REFERENCES "SchoolYear"("id") ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Audit Log
-- ---------------------------------------------------------------------------

CREATE TABLE "AuditLog" (
  "id"          UUID          NOT NULL DEFAULT gen_random_uuid(),
  "actorId"     UUID,
  "actorRole"   "Role",
  "action"      "AuditAction" NOT NULL,
  "targetType"  TEXT          NOT NULL,
  "targetId"    TEXT,
  "targetLabel" TEXT,
  "beforeValue" JSONB,
  "afterValue"  JSONB,
  "reason"      TEXT,
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  "createdAt"   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_actorId_idx"    ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_action_idx"     ON "AuditLog"("action");
CREATE INDEX "AuditLog_targetType_idx" ON "AuditLog"("targetType");
CREATE INDEX "AuditLog_targetId_idx"   ON "AuditLog"("targetId");
CREATE INDEX "AuditLog_createdAt_idx"  ON "AuditLog"("createdAt");
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL;
