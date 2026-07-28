import {
  PrismaClient,
  Gender,
  GradeLevel,
  Role,
  AccountStatus,
  RotationStatus,
  SubmissionStatus,
} from '@prisma/client'
import bcrypt from 'bcryptjs'
import { seedActivityRubric } from '../src/lib/skills/seed-rubric'

const db = new PrismaClient()

const PASSWORD_HASH = bcrypt.hashSync('MICDS2024!', 12)
// Admin gets its own password, distinct from the shared demo-account password
// above, since the admin account is a real credential used outside of demos.
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('MICDS2026!', 12)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg: string) {
  console.log(`  ${msg}`)
}

async function main() {
  console.log('\n=== MICDS PE Grading — Database Seed ===\n')

  // =========================================================================
  // School Year
  // =========================================================================
  const schoolYear = await db.schoolYear.upsert({
    where: { name: '2026-2027' },
    update: {},
    create: {
      name: '2026-2027',
      startDate: new Date('2026-08-26'),
      endDate: new Date('2027-06-05'),
      isActive: true,
    },
  })
  log('School year 2026-2027 upserted')

  // =========================================================================
  // Activity Templates
  // =========================================================================
  const activityDefs = [
    { name: 'Athletic Development', gender: Gender.MALE,   gradeLevel: GradeLevel.GRADE_6, description: 'Foundational movement skills, strength, and conditioning.' },
    { name: 'Ultimate Frisbee',     gender: Gender.MALE,   gradeLevel: GradeLevel.GRADE_6, description: 'Team sport combining disc skills with strategy.' },
    { name: 'Flag Football',        gender: Gender.MALE,   gradeLevel: GradeLevel.GRADE_6, description: 'Non-contact version of American football.' },
    { name: 'Tennis',               gender: Gender.MALE,   gradeLevel: GradeLevel.GRADE_6, description: 'Individual and doubles racket sport.' },
    { name: 'Wrestling',            gender: Gender.MALE,   gradeLevel: GradeLevel.GRADE_6, description: 'Grappling fundamentals and positional awareness.' },
    { name: 'Volleyball',           gender: Gender.FEMALE, gradeLevel: GradeLevel.GRADE_6, description: 'Team court sport with serve, set, and spike.' },
    { name: 'Floor Hockey',         gender: Gender.FEMALE, gradeLevel: GradeLevel.GRADE_6, description: 'Indoor hockey variant using plastic sticks and pucks.' },
    { name: 'Squash',               gender: Gender.FEMALE, gradeLevel: GradeLevel.GRADE_6, description: 'Racket sport played in an enclosed court.' },
    { name: 'Yoga',                 gender: Gender.FEMALE, gradeLevel: GradeLevel.GRADE_6, description: 'Flexibility, balance, and mindfulness practice.' },
  ]

  const activityMap: Record<string, string> = {}
  for (const act of activityDefs) {
    const found = await db.activityTemplate.findFirst({
      where: { name: act.name, gender: act.gender, gradeLevel: act.gradeLevel },
    })
    const template = found ?? await db.activityTemplate.create({
      data: { name: act.name, description: act.description, gender: act.gender, gradeLevel: act.gradeLevel, isActive: true },
    })
    activityMap[act.name] = template.id
  }
  log(`${activityDefs.length} activity templates upserted`)

  // =========================================================================
  // Admin
  // =========================================================================
  const adminUser = await db.user.upsert({
    where: { email: 'admin@micds.org' },
    update: {},
    create: {
      email: 'admin@micds.org',
      passwordHash: ADMIN_PASSWORD_HASH,
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date('2026-08-01'),
    },
  })
  log('Admin user upserted (admin@micds.org)')

  // =========================================================================
  // Teachers
  // =========================================================================
  const teacherDefs = [
    { email: 'sarah.johnson@micds.org', firstName: 'Sarah',   lastName: 'Johnson', employeeId: 'T001' },
    { email: 'michael.chen@micds.org',  firstName: 'Michael', lastName: 'Chen',    employeeId: 'T002' },
  ]

  const teacherProfileMap: Record<string, string> = {}
  for (const t of teacherDefs) {
    const user = await db.user.upsert({
      where: { email: t.email },
      update: {},
      create: {
        email: t.email,
        passwordHash: PASSWORD_HASH,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        emailVerifiedAt: new Date('2026-08-01'),
      },
    })
    const found = await db.teacherProfile.findUnique({ where: { userId: user.id } })
    const profile = found ?? await db.teacherProfile.create({
      data: { userId: user.id, firstName: t.firstName, lastName: t.lastName, employeeId: t.employeeId },
    })
    teacherProfileMap[t.email] = profile.id
  }
  log('2 teachers upserted (Sarah Johnson, Michael Chen)')

  // =========================================================================
  // Students
  // =========================================================================
  const studentDefs = [
    // Group A — 6th Grade Boys
    { email: 'alex.thompson@micds.org',    firstName: 'Alex',    lastName: 'Thompson', gender: Gender.MALE,   gradeLevel: GradeLevel.GRADE_6, studentId: 'S001', group: 'A' },
    { email: 'jordan.williams@micds.org',  firstName: 'Jordan',  lastName: 'Williams', gender: Gender.MALE,   gradeLevel: GradeLevel.GRADE_6, studentId: 'S002', group: 'A' },
    { email: 'casey.brown@micds.org',      firstName: 'Casey',   lastName: 'Brown',    gender: Gender.MALE,   gradeLevel: GradeLevel.GRADE_6, studentId: 'S003', group: 'A' },
    // Group B — 6th Grade Girls
    { email: 'emma.davis@micds.org',       firstName: 'Emma',    lastName: 'Davis',    gender: Gender.FEMALE, gradeLevel: GradeLevel.GRADE_6, studentId: 'S004', group: 'B' },
    { email: 'olivia.martinez@micds.org',  firstName: 'Olivia',  lastName: 'Martinez', gender: Gender.FEMALE, gradeLevel: GradeLevel.GRADE_6, studentId: 'S005', group: 'B' },
    { email: 'sophie.lee@micds.org',       firstName: 'Sophie',  lastName: 'Lee',      gender: Gender.FEMALE, gradeLevel: GradeLevel.GRADE_6, studentId: 'S006', group: 'B' },
  ]

  const studentProfileMap: Record<string, string> = {}
  for (const s of studentDefs) {
    const user = await db.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        passwordHash: PASSWORD_HASH,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        emailVerifiedAt: new Date('2026-08-15'),
      },
    })
    const found = await db.studentProfile.findUnique({ where: { userId: user.id } })
    const profile = found ?? await db.studentProfile.create({
      data: {
        userId: user.id,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        gradeLevel: s.gradeLevel,
        studentId: s.studentId,
      },
    })
    studentProfileMap[s.email] = profile.id
  }
  log('6 students upserted (3 boys, 3 girls)')

  // =========================================================================
  // Parent
  // =========================================================================
  const parentUser = await db.user.upsert({
    where: { email: 'r.thompson@micds.org' },
    update: {},
    create: {
      email: 'r.thompson@micds.org',
      passwordHash: PASSWORD_HASH,
      role: Role.PARENT,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date('2026-08-15'),
    },
  })
  const foundParent = await db.parentProfile.findUnique({ where: { userId: parentUser.id } })
  const parentProfile = foundParent ?? await db.parentProfile.create({
    data: { userId: parentUser.id, firstName: 'Robert', lastName: 'Thompson' },
  })
  const alexStudentId = studentProfileMap['alex.thompson@micds.org']
  await db.parentStudentLink.upsert({
    where: {
      parentProfileId_studentProfileId: {
        parentProfileId: parentProfile.id,
        studentProfileId: alexStudentId,
      },
    },
    update: {},
    create: {
      parentProfileId: parentProfile.id,
      studentProfileId: alexStudentId,
      createdBy: adminUser.id,
    },
  })
  log('Parent Robert Thompson upserted, linked to Alex Thompson')

  // =========================================================================
  // Student Groups
  // =========================================================================
  const groupA = await db.studentGroup.upsert({
    where: { schoolYearId_name: { schoolYearId: schoolYear.id, name: '6th Grade Boys - Group A' } },
    update: {},
    create: {
      schoolYearId: schoolYear.id,
      name: '6th Grade Boys - Group A',
      gradeLevel: GradeLevel.GRADE_6,
      gender: Gender.MALE,
      description: 'Sixth-grade boys rotation group for 2026-2027.',
      isActive: true,
    },
  })
  const groupB = await db.studentGroup.upsert({
    where: { schoolYearId_name: { schoolYearId: schoolYear.id, name: '6th Grade Girls - Group B' } },
    update: {},
    create: {
      schoolYearId: schoolYear.id,
      name: '6th Grade Girls - Group B',
      gradeLevel: GradeLevel.GRADE_6,
      gender: Gender.FEMALE,
      description: 'Sixth-grade girls rotation group for 2026-2027.',
      isActive: true,
    },
  })

  const groupAEmails = ['alex.thompson@micds.org', 'jordan.williams@micds.org', 'casey.brown@micds.org']
  const groupBEmails = ['emma.davis@micds.org', 'olivia.martinez@micds.org', 'sophie.lee@micds.org']

  for (const email of groupAEmails) {
    await db.studentGroupMembership.upsert({
      where: { studentGroupId_studentProfileId: { studentGroupId: groupA.id, studentProfileId: studentProfileMap[email] } },
      update: {},
      create: { studentGroupId: groupA.id, studentProfileId: studentProfileMap[email] },
    })
  }
  for (const email of groupBEmails) {
    await db.studentGroupMembership.upsert({
      where: { studentGroupId_studentProfileId: { studentGroupId: groupB.id, studentProfileId: studentProfileMap[email] } },
      update: {},
      create: { studentGroupId: groupB.id, studentProfileId: studentProfileMap[email] },
    })
  }
  log('2 student groups created with 3 members each')

  // =========================================================================
  // Teacher Class Assignments
  // =========================================================================
  // Sarah: Athletic Development, Tennis, Wrestling, Volleyball, Yoga
  // Michael: Ultimate Frisbee, Flag Football, Squash, Floor Hockey
  const tcaAssignments: Array<{ teacher: string; activity: string }> = [
    { teacher: 'sarah.johnson@micds.org', activity: 'Athletic Development' },
    { teacher: 'sarah.johnson@micds.org', activity: 'Tennis' },
    { teacher: 'sarah.johnson@micds.org', activity: 'Wrestling' },
    { teacher: 'sarah.johnson@micds.org', activity: 'Volleyball' },
    { teacher: 'sarah.johnson@micds.org', activity: 'Yoga' },
    { teacher: 'michael.chen@micds.org',  activity: 'Ultimate Frisbee' },
    { teacher: 'michael.chen@micds.org',  activity: 'Flag Football' },
    { teacher: 'michael.chen@micds.org',  activity: 'Squash' },
    { teacher: 'michael.chen@micds.org',  activity: 'Floor Hockey' },
  ]

  const tcaMap: Record<string, string> = {}
  for (const tca of tcaAssignments) {
    const teacherId = teacherProfileMap[tca.teacher]
    const actId = activityMap[tca.activity]
    if (!teacherId || !actId) {
      console.warn(`    WARNING: Could not resolve teacher or activity for ${tca.teacher} / ${tca.activity}`)
      continue
    }
    const found = await db.teacherClassAssignment.findFirst({
      where: { teacherProfileId: teacherId, activityTemplateId: actId, schoolYearId: schoolYear.id },
    })
    const assignment = found ?? await db.teacherClassAssignment.create({
      data: { teacherProfileId: teacherId, activityTemplateId: actId, schoolYearId: schoolYear.id, isActive: true },
    })
    tcaMap[tca.activity] = assignment.id
  }
  log('9 teacher-class assignments created')

  // =========================================================================
  // Carousel Plan — 9 positions (one per activity)
  // =========================================================================
  // Order matches the rotation sequence used below
  const carouselOrder = [
    'Athletic Development', // pos 1
    'Ultimate Frisbee',     // pos 2
    'Flag Football',        // pos 3
    'Tennis',               // pos 4
    'Squash',               // pos 5
    'Volleyball',           // pos 6
    'Floor Hockey',         // pos 7
    'Wrestling',            // pos 8
    'Yoga',                 // pos 9
  ]

  const existingPlan = await db.carouselPlan.findFirst({
    where: { schoolYearId: schoolYear.id, name: '2026-2027 6th Grade Carousel' },
  })
  const plan = existingPlan ?? await db.carouselPlan.create({
    data: {
      schoolYearId: schoolYear.id,
      name: '2026-2027 6th Grade Carousel',
      isActive: true,
      createdBy: adminUser.id,
    },
  })

  // Positions belong to exactly one student group's own carousel — the same
  // 9-activity order is instantiated once per group (18 rows total), each
  // row scoped by (studentGroupId, positionOrder), mirroring how the admin
  // carousel API creates positions (src/app/api/admin/carousel/[id]/positions/route.ts).
  const positionMap: Record<string, string> = {} // keyed by `${studentGroupId}:${positionOrder}`
  for (const group of [groupA, groupB]) {
    for (let i = 0; i < carouselOrder.length; i++) {
      const actName = carouselOrder[i]
      const tcaId = tcaMap[actName]
      if (!tcaId) {
        console.warn(`    WARNING: No TCA found for carousel activity: ${actName}`)
        continue
      }
      const positionOrder = i + 1
      const found = await db.carouselPosition.findUnique({
        where: { studentGroupId_positionOrder: { studentGroupId: group.id, positionOrder } },
      })
      const pos = found ?? await db.carouselPosition.create({
        data: { carouselPlanId: plan.id, studentGroupId: group.id, positionOrder, teacherClassAssignmentId: tcaId },
      })
      positionMap[`${group.id}:${positionOrder}`] = pos.id
    }
  }
  log('Carousel plan with 9 positions created for each of the 2 groups (18 total)')

  // =========================================================================
  // Group Rotation Assignments
  // =========================================================================
  // Rotation dates (~6 weeks each)
  const rotationDates = [
    { start: new Date('2026-08-26'), end: new Date('2026-09-27') },
    { start: new Date('2026-09-30'), end: new Date('2026-11-08') },
    { start: new Date('2026-11-11'), end: new Date('2026-12-20') },
    { start: new Date('2027-01-06'), end: new Date('2027-02-14') },
    { start: new Date('2027-02-17'), end: new Date('2027-03-28') },
    { start: new Date('2027-03-31'), end: new Date('2027-05-09') },
    { start: new Date('2027-05-12'), end: new Date('2027-06-05') },
  ]

  // For 9 activities across 2 groups we pair them:
  // Rotation 1: Group A = pos1 (Athletic Dev/Sarah), Group B = pos6 (Volleyball/Sarah)
  // Rotation 2: Group A = pos2 (Ultimate Frisbee/Michael), Group B = pos7 (Floor Hockey/Michael)
  // Rotation 3 (ACTIVE): Group A = pos3 (Flag Football/Michael), Group B = pos8 (Wrestling/Sarah)
  // Rotations 4-9: UPCOMING with remaining positions

  type RotDef = {
    groupAPos: number
    groupBPos: number
    status: RotationStatus
    dateIdx: number
  }

  const rotationDefs: RotDef[] = [
    { groupAPos: 1, groupBPos: 6, status: RotationStatus.LOCKED,    dateIdx: 0 },
    { groupAPos: 2, groupBPos: 7, status: RotationStatus.LOCKED,    dateIdx: 1 },
    { groupAPos: 3, groupBPos: 8, status: RotationStatus.ACTIVE,    dateIdx: 2 },
    { groupAPos: 4, groupBPos: 9, status: RotationStatus.UPCOMING,  dateIdx: 3 },
    { groupAPos: 5, groupBPos: 1, status: RotationStatus.UPCOMING,  dateIdx: 4 },
    { groupAPos: 6, groupBPos: 2, status: RotationStatus.UPCOMING,  dateIdx: 5 },
    { groupAPos: 7, groupBPos: 3, status: RotationStatus.UPCOMING,  dateIdx: 6 },
    { groupAPos: 8, groupBPos: 4, status: RotationStatus.UPCOMING,  dateIdx: 6 },
    { groupAPos: 9, groupBPos: 5, status: RotationStatus.UPCOMING,  dateIdx: 6 },
  ]

  // Track rotation assignments by [group, rotNum] -> id
  const graMap: Record<string, string> = {}

  for (let rotNum = 1; rotNum <= rotationDefs.length; rotNum++) {
    const def = rotationDefs[rotNum - 1]
    const dates = rotationDates[Math.min(def.dateIdx, rotationDates.length - 1)]
    const posAId = positionMap[`${groupA.id}:${def.groupAPos}`]
    const posBId = positionMap[`${groupB.id}:${def.groupBPos}`]

    if (posAId) {
      const found = await db.groupRotationAssignment.findFirst({
        where: { studentGroupId: groupA.id, carouselPositionId: posAId, rotationNumber: rotNum },
      })
      const gra = found ?? await db.groupRotationAssignment.create({
        data: {
          schoolYearId: schoolYear.id,
          studentGroupId: groupA.id,
          carouselPositionId: posAId,
          startDate: dates.start,
          endDate: dates.end,
          status: def.status,
          rotationNumber: rotNum,
        },
      })
      graMap[`A-${rotNum}`] = gra.id
    }

    if (posBId) {
      const found = await db.groupRotationAssignment.findFirst({
        where: { studentGroupId: groupB.id, carouselPositionId: posBId, rotationNumber: rotNum },
      })
      const gra = found ?? await db.groupRotationAssignment.create({
        data: {
          schoolYearId: schoolYear.id,
          studentGroupId: groupB.id,
          carouselPositionId: posBId,
          startDate: dates.start,
          endDate: dates.end,
          status: def.status,
          rotationNumber: rotNum,
        },
      })
      graMap[`B-${rotNum}`] = gra.id
    }
  }
  log('9 rotation assignments per group created (2 locked, 1 active, 6 upcoming)')

  // =========================================================================
  // Historical Class Instances
  // =========================================================================
  // Rotations 1 & 2 (LOCKED), Rotation 3 (ACTIVE)
  type HCIDef = {
    graKey: string
    groupId: string
    activityName: string
    status: RotationStatus
    lockedAt?: Date
  }

  const hciDefs: HCIDef[] = [
    // Rotation 1
    { graKey: 'A-1', groupId: groupA.id, activityName: 'Athletic Development', status: RotationStatus.LOCKED,  lockedAt: new Date('2026-09-28') },
    { graKey: 'B-1', groupId: groupB.id, activityName: 'Volleyball',           status: RotationStatus.LOCKED,  lockedAt: new Date('2026-09-28') },
    // Rotation 2
    { graKey: 'A-2', groupId: groupA.id, activityName: 'Ultimate Frisbee',     status: RotationStatus.LOCKED,  lockedAt: new Date('2026-11-09') },
    { graKey: 'B-2', groupId: groupB.id, activityName: 'Floor Hockey',         status: RotationStatus.LOCKED,  lockedAt: new Date('2026-11-09') },
    // Rotation 3
    { graKey: 'A-3', groupId: groupA.id, activityName: 'Flag Football',        status: RotationStatus.ACTIVE },
    { graKey: 'B-3', groupId: groupB.id, activityName: 'Wrestling',            status: RotationStatus.ACTIVE },
  ]

  const hciMap: Record<string, string> = {}

  for (const h of hciDefs) {
    const graId = graMap[h.graKey]
    const tcaId = tcaMap[h.activityName]
    if (!graId || !tcaId) {
      console.warn(`    WARNING: Cannot create HCI for ${h.graKey} / ${h.activityName}`)
      continue
    }
    const found = await db.historicalClassInstance.findUnique({
      where: {
        groupRotationAssignmentId_studentGroupId_teacherClassAssignmentId: {
          groupRotationAssignmentId: graId,
          studentGroupId: h.groupId,
          teacherClassAssignmentId: tcaId,
        },
      },
    })
    const hci = found ?? await db.historicalClassInstance.create({
      data: {
        groupRotationAssignmentId: graId,
        studentGroupId: h.groupId,
        teacherClassAssignmentId: tcaId,
        schoolYearId: schoolYear.id,
        status: h.status,
        ...(h.lockedAt ? { lockedAt: h.lockedAt, lockedBy: adminUser.id } : {}),
      },
    })
    hciMap[h.graKey] = hci.id
  }
  log('6 historical class instances created (4 locked, 2 active)')

  // =========================================================================
  // Rubric Versions + Skill Definitions + Prompt Definitions
  // =========================================================================
  // Every activity's Standard 1 skills and Standard 2-4 concept questions are
  // loaded from the versioned config in src/lib/skills/* (transcribed
  // verbatim from the source rubric spreadsheets) so grading and student
  // submissions work identically for the full nine-activity carousel.
  const athDevId = activityMap['Athletic Development']

  // skillDefMap/promptDefMap are keyed by "<activityName>|<skillName>" and
  // "<activityName>|<standardNumber>-<displayOrder>" so the sample-grade
  // section below can look up real IDs by name instead of guessing them.
  const skillDefMap: Record<string, string> = {}
  const promptDefMap: Record<string, string> = {}

  for (const [activityName, activityId] of Object.entries(activityMap)) {
    const result = await seedActivityRubric(db, activityId, activityName)
    for (const [skillName, id] of Object.entries(result.skillIdsByName)) {
      skillDefMap[`${activityName}|${skillName}`] = id
    }
    for (const [stdOrder, id] of Object.entries(result.promptIdsByStdOrder)) {
      promptDefMap[`${activityName}|${stdOrder}`] = id
    }
  }
  log('Rubric versions, skill definitions, and prompt definitions created for all 9 activities')

  // =========================================================================
  // Sample Grades — Rotation 1, Alex Thompson in Athletic Development
  // =========================================================================
  const alexId = studentProfileMap['alex.thompson@micds.org']
  const sarahId = teacherProfileMap['sarah.johnson@micds.org']
  const michaelId = teacherProfileMap['michael.chen@micds.org']
  const hci1AId = hciMap['A-1'] // Athletic Development, Group A, Rotation 1 (LOCKED)
  const hci2AId = hciMap['A-2'] // Ultimate Frisbee, Group A, Rotation 2 (LOCKED)
  const hci3AId = hciMap['A-3'] // Flag Football, Group A, Rotation 3 (ACTIVE)

  // -------------------------------------------------------------------------
  // Rotation 1 — Alex Thompson, Athletic Development (fully graded, LOCKED)
  // -------------------------------------------------------------------------
  if (hci1AId && alexId && sarahId) {
    // Standard 1 — teacher assessment with skill scores
    const foundA1s1 = await db.teacherAssessment.findUnique({
      where: {
        teacherProfileId_historicalClassInstanceId_studentProfileId_standardNumber: {
          teacherProfileId: sarahId,
          historicalClassInstanceId: hci1AId,
          studentProfileId: alexId,
          standardNumber: 1,
        },
      },
    })
    const ta1s1 = foundA1s1 ?? await db.teacherAssessment.create({
      data: {
        teacherProfileId: sarahId,
        historicalClassInstanceId: hci1AId,
        studentProfileId: alexId,
        standardNumber: 1,
        score: 3.5,
        feedback: 'Alex shows good form in the squat and hip hinge. Keep working on the lateral lunge.',
        isFeedbackStudentVisible: true,
      },
    })
    // Skill scores: Squat=4, Lateral Lunge=3, Hip Hinge/RDL=3 → allGreen, 1/3 bright → 3.5
    const skillScoreData: Array<{ name: string; score: number }> = [
      { name: 'Squat', score: 4 },
      { name: 'Lateral Lunge', score: 3 },
      { name: 'Hip Hinge/RDL', score: 3 },
    ]
    for (const ss of skillScoreData) {
      const sdId = skillDefMap[`Athletic Development|${ss.name}`]
      if (!sdId) continue
      await db.teacherSkillScore.upsert({
        where: { teacherAssessmentId_skillDefinitionId: { teacherAssessmentId: ta1s1.id, skillDefinitionId: sdId } },
        update: {},
        create: { teacherAssessmentId: ta1s1.id, skillDefinitionId: sdId, score: ss.score },
      })
    }

    // Standard 2 — 2 prompts, both scored 3 → allGreen, 0% bright → 3.0
    const foundA1s2 = await db.teacherAssessment.findUnique({
      where: {
        teacherProfileId_historicalClassInstanceId_studentProfileId_standardNumber: {
          teacherProfileId: sarahId, historicalClassInstanceId: hci1AId, studentProfileId: alexId, standardNumber: 2,
        },
      },
    })
    const ta1s2 = foundA1s2 ?? await db.teacherAssessment.create({
      data: {
        teacherProfileId: sarahId, historicalClassInstanceId: hci1AId, studentProfileId: alexId,
        standardNumber: 2, score: 3.0,
        feedback: 'Good understanding of how movement patterns transfer to other activities.',
        isFeedbackStudentVisible: true,
      },
    })
    for (const displayOrder of [1, 2]) {
      const pdId = promptDefMap[`Athletic Development|2-${displayOrder}`]
      if (!pdId) continue
      await db.teacherPromptScore.upsert({
        where: { teacherAssessmentId_promptDefinitionId: { teacherAssessmentId: ta1s2.id, promptDefinitionId: pdId } },
        update: {},
        create: { teacherAssessmentId: ta1s2.id, promptDefinitionId: pdId, score: 3 },
      })
    }

    // Standard 3 — 2 prompts, scored 3 and 2 → 50% green, no red → 2.0
    const foundA1s3 = await db.teacherAssessment.findUnique({
      where: {
        teacherProfileId_historicalClassInstanceId_studentProfileId_standardNumber: {
          teacherProfileId: sarahId, historicalClassInstanceId: hci1AId, studentProfileId: alexId, standardNumber: 3,
        },
      },
    })
    const ta1s3 = foundA1s3 ?? await db.teacherAssessment.create({
      data: {
        teacherProfileId: sarahId, historicalClassInstanceId: hci1AId, studentProfileId: alexId,
        standardNumber: 3, score: 2.0,
        feedback: 'Developing a solid understanding of health concepts. Work on connecting activity to long-term wellness.',
        isFeedbackStudentVisible: false,
      },
    })
    const std3Scores = [3, 2]
    for (let i = 0; i < std3Scores.length; i++) {
      const pdId = promptDefMap[`Athletic Development|3-${i + 1}`]
      if (!pdId) continue
      await db.teacherPromptScore.upsert({
        where: { teacherAssessmentId_promptDefinitionId: { teacherAssessmentId: ta1s3.id, promptDefinitionId: pdId } },
        update: {},
        create: { teacherAssessmentId: ta1s3.id, promptDefinitionId: pdId, score: std3Scores[i] },
      })
    }

    // Standard 4 — 1 concept question + student self-rating + teacher rating, all 3 → 3.0
    const foundA1s4 = await db.teacherAssessment.findUnique({
      where: {
        teacherProfileId_historicalClassInstanceId_studentProfileId_standardNumber: {
          teacherProfileId: sarahId, historicalClassInstanceId: hci1AId, studentProfileId: alexId, standardNumber: 4,
        },
      },
    })
    const ta1s4 = foundA1s4 ?? await db.teacherAssessment.create({
      data: {
        teacherProfileId: sarahId, historicalClassInstanceId: hci1AId, studentProfileId: alexId,
        standardNumber: 4, score: 3.0,
        feedback: 'Alex is a positive team member and encourages peers during challenging activities.',
        isFeedbackStudentVisible: true,
      },
    })
    const pd41Id = promptDefMap['Athletic Development|4-1']
    if (pd41Id) {
      await db.teacherPromptScore.upsert({
        where: { teacherAssessmentId_promptDefinitionId: { teacherAssessmentId: ta1s4.id, promptDefinitionId: pd41Id } },
        update: {},
        create: { teacherAssessmentId: ta1s4.id, promptDefinitionId: pd41Id, score: 3 },
      })
    }
    await db.teacherStandard4Rating.upsert({
      where: { teacherAssessmentId: ta1s4.id },
      update: {},
      create: { teacherAssessmentId: ta1s4.id, rating: 3 },
    })

    // Grade snapshot — rotation 1, Alex
    // Internal values: 3.5->0.9, 3.0->0.8, 2.0->0.7, 3.0->0.8 → avg 0.8 → B-
    const foundSnap1 = await db.gradeCalculationSnapshot.findFirst({
      where: { studentProfileId: alexId, historicalClassInstanceId: hci1AId },
    })
    foundSnap1 || await db.gradeCalculationSnapshot.create({
      data: {
        studentProfileId: alexId,
        historicalClassInstanceId: hci1AId,
        schoolYearId: schoolYear.id,
        standard1Score: 3.5,
        standard2Score: 3.0,
        standard3Score: 2.0,
        standard4Score: 3.0,
        overallAverage: 0.8,
        letterGrade: 'B-',
        snapshotData: {
          method: 'seed',
          breakdown: {
            standard1: { rawScore: 3.5, internalValue: 0.9, weight: 0.25 },
            standard2: { rawScore: 3.0, internalValue: 0.8, weight: 0.25 },
            standard3: { rawScore: 2.0, internalValue: 0.7, weight: 0.25 },
            standard4: { rawScore: 3.0, internalValue: 0.8, weight: 0.25 },
          },
          gradeBoundaries: 'B-: 0.77–0.82',
        },
      },
    })

    // ATL record — rotation 1
    const foundAtl1 = await db.approachToLearningRecord.findUnique({
      where: { studentProfileId_historicalClassInstanceId: { studentProfileId: alexId, historicalClassInstanceId: hci1AId } },
    })
    foundAtl1 || await db.approachToLearningRecord.create({
      data: {
        studentProfileId: alexId,
        historicalClassInstanceId: hci1AId,
        teacherProfileId: sarahId,
        responsiblePrepared: 4,
        respectfulWorks: 4,
        effortTeacherScore: 4,
        effortStudentScore: 3,
        daysLateUnprepared: 0,
        // (4 + 4 + 4 + 3 + 4[daysLateScore]) / 5 = 3.8
        calculatedScore: 3.8,
      },
    })

    // Student submissions for Standards 2, 3, 4 — rotation 1
    interface SubmissionDef {
      standardNumber: number
      status: SubmissionStatus
      honorCodeAcknowledgedAt: Date
      honorCodeVersion: string
      submittedAt: Date
      reassessmentSubmittedAt?: Date
      latestAttemptNumber: number
      priorAttempt?: { attemptNumber: number; submittedAt: Date; responses: { key: string; text: string }[] }
      responses: { key: string; text: string }[]
    }

    const submissionDefs: SubmissionDef[] = [
      {
        standardNumber: 2,
        status: SubmissionStatus.SUBMITTED,
        honorCodeAcknowledgedAt: new Date('2026-09-18'),
        honorCodeVersion: '1.0',
        submittedAt: new Date('2026-09-18'),
        latestAttemptNumber: 1,
        responses: [
          {
            key: 'Athletic Development|2-1',
            text: 'The force platform shows you the amount of force and power you produce, so you can track whether your jumps and lifts are actually improving over time instead of guessing.',
          },
          {
            key: 'Athletic Development|2-2',
            text: 'Even if you never play a sport, the exercises build strength and mobility you use every day, like carrying groceries, climbing stairs, or picking things up safely.',
          },
        ],
      },
      {
        standardNumber: 3,
        status: SubmissionStatus.REASSESSMENT_SUBMITTED,
        honorCodeAcknowledgedAt: new Date('2026-09-19'),
        honorCodeVersion: '1.0',
        submittedAt: new Date('2026-09-19'),
        reassessmentSubmittedAt: new Date('2026-09-25'),
        latestAttemptNumber: 2,
        // Attempt 1 (superseded) — frozen into a history entry below.
        priorAttempt: {
          attemptNumber: 1,
          submittedAt: new Date('2026-09-19'),
          responses: [
            { key: 'Athletic Development|3-1', text: 'Strength training makes your muscles stronger.' },
            {
              key: 'Athletic Development|3-2',
              text: 'The three energy systems are phosphagen, glycolytic, and aerobic. Phosphagen is used for very short, max-effort bursts, glycolytic takes over for efforts lasting under about two minutes, and aerobic becomes the main system for anything longer than that.',
            },
          ],
        },
        // Attempt 2 (current/live) — meaningfully revised prompt 3-1.
        responses: [
          {
            key: 'Athletic Development|3-1',
            text: 'Improving strength also helps your posture and balance, which lowers your risk of injury both in sports and in everyday movements like lifting or catching yourself if you trip.',
          },
          {
            key: 'Athletic Development|3-2',
            text: 'The three energy systems are phosphagen, glycolytic, and aerobic. Phosphagen is used for very short, max-effort bursts, glycolytic takes over for efforts lasting under about two minutes, and aerobic becomes the main system for anything longer than that.',
          },
        ],
      },
      {
        standardNumber: 4,
        status: SubmissionStatus.SUBMITTED,
        honorCodeAcknowledgedAt: new Date('2026-09-20'),
        honorCodeVersion: '1.0',
        submittedAt: new Date('2026-09-20'),
        latestAttemptNumber: 1,
        responses: [
          {
            key: 'Athletic Development|4-1',
            text: 'Hard work sets the tone for the group — when I push myself during a tough set, it encourages the people training next to me to keep going too instead of giving up.',
          },
        ],
      },
    ]

    for (const subDef of submissionDefs) {
      const foundSub = await db.studentSubmission.findUnique({
        where: {
          studentProfileId_historicalClassInstanceId_standardNumber: {
            studentProfileId: alexId,
            historicalClassInstanceId: hci1AId,
            standardNumber: subDef.standardNumber,
          },
        },
      })
      const sub = foundSub ?? await db.studentSubmission.create({
        data: {
          studentProfileId: alexId,
          historicalClassInstanceId: hci1AId,
          standardNumber: subDef.standardNumber,
          status: subDef.status,
          honorCodeAcknowledgedAt: subDef.honorCodeAcknowledgedAt,
          honorCodeVersion: subDef.honorCodeVersion,
          submittedAt: subDef.submittedAt,
          reassessmentSubmittedAt: subDef.reassessmentSubmittedAt ?? null,
          latestAttemptNumber: subDef.latestAttemptNumber,
        },
      })

      for (const resp of subDef.responses) {
        const pdId = promptDefMap[resp.key]
        if (!pdId) {
          console.warn(`    WARNING: Prompt def not found for key ${resp.key}`)
          continue
        }
        const foundWr = await db.writtenResponse.findUnique({
          where: { studentSubmissionId_promptDefinitionId: { studentSubmissionId: sub.id, promptDefinitionId: pdId } },
        })
        foundWr || await db.writtenResponse.create({
          data: {
            studentSubmissionId: sub.id,
            promptDefinitionId: pdId,
            responseText: resp.text,
            submittedAt: subDef.submittedAt,
          },
        })
      }

      // Demonstrate the resubmission-history feature: freeze the superseded
      // attempt as a SubmissionHistoryEntry snapshot.
      const priorAttempt = subDef.priorAttempt
      if (priorAttempt) {
        const foundHistory = await db.submissionHistoryEntry.findUnique({
          where: { studentSubmissionId_attemptNumber: { studentSubmissionId: sub.id, attemptNumber: priorAttempt.attemptNumber } },
        })
        foundHistory || await db.submissionHistoryEntry.create({
          data: {
            studentSubmissionId: sub.id,
            attemptNumber: priorAttempt.attemptNumber,
            submittedAt: priorAttempt.submittedAt,
            snapshotData: {
              writtenResponses: priorAttempt.responses.map((r) => ({
                promptDefinitionId: promptDefMap[r.key],
                responseText: r.text,
              })),
            },
          },
        })
      }

      // Standard 4 also carries the student's self-rating of teamwork/leadership
      if (subDef.standardNumber === 4) {
        await db.studentStandard4SelfRating.upsert({
          where: { studentSubmissionId: sub.id },
          update: {},
          create: { studentSubmissionId: sub.id, studentProfileId: alexId, rating: 3 },
        })
      }
    }
  }
  log('Rotation 1: Alex Thompson fully graded (assessments, skill scores, snapshot, ATL, submissions)')

  // -------------------------------------------------------------------------
  // Rotation 2 — Alex Thompson, Ultimate Frisbee (LOCKED)
  // -------------------------------------------------------------------------
  if (hci2AId && alexId && michaelId) {
    const stdScores: Array<{ std: number; score: number; feedback: string; visible: boolean }> = [
      { std: 1, score: 3.0, feedback: 'Solid throwing mechanics. Work on the hammer throw and reading the disc in the wind.', visible: true },
      { std: 2, score: 2.5, feedback: 'Beginning to understand offensive spacing. Continue thinking about cutting lanes.', visible: true },
      { std: 3, score: 3.5, feedback: 'Excellent fitness understanding — connected aerobic demands of Ultimate to VO2 max concepts.', visible: true },
      { std: 4, score: 3.0, feedback: 'Good spirit. Called fouls accurately and accepted calls graciously.', visible: true },
    ]

    const assessmentByStd2A: Partial<Record<number, { id: string }>> = {}
    for (const s of stdScores) {
      const found = await db.teacherAssessment.findUnique({
        where: {
          teacherProfileId_historicalClassInstanceId_studentProfileId_standardNumber: {
            teacherProfileId: michaelId, historicalClassInstanceId: hci2AId, studentProfileId: alexId, standardNumber: s.std,
          },
        },
      })
      assessmentByStd2A[s.std] = found ?? await db.teacherAssessment.create({
        data: {
          teacherProfileId: michaelId, historicalClassInstanceId: hci2AId, studentProfileId: alexId,
          standardNumber: s.std, score: s.score, feedback: s.feedback, isFeedbackStudentVisible: s.visible,
        },
      })
    }

    // Item-level scores backing the aggregates above, so the Class Analytics
    // distribution charts have something to show for this rotation too (not
    // just the roster's aggregate score/letter grade).
    const ta2s1 = assessmentByStd2A[1]!
    const skillScoreData2: Array<{ name: string; score: number }> = [
      { name: 'Elbow Side Plank', score: 3 },
      { name: 'Lateral Leap', score: 3 },
      { name: 'Throwing', score: 4 },
      { name: 'Catching', score: 2 },
      { name: 'Defensive Skill', score: 2 },
    ]
    for (const ss of skillScoreData2) {
      const sdId = skillDefMap[`Ultimate Frisbee|${ss.name}`]
      if (!sdId) continue
      await db.teacherSkillScore.upsert({
        where: { teacherAssessmentId_skillDefinitionId: { teacherAssessmentId: ta2s1.id, skillDefinitionId: sdId } },
        update: {},
        create: { teacherAssessmentId: ta2s1.id, skillDefinitionId: sdId, score: ss.score },
      })
    }

    const ta2s2 = assessmentByStd2A[2]!
    const std2Scores2 = [3, 2]
    for (let i = 0; i < std2Scores2.length; i++) {
      const pdId = promptDefMap[`Ultimate Frisbee|2-${i + 1}`]
      if (!pdId) continue
      await db.teacherPromptScore.upsert({
        where: { teacherAssessmentId_promptDefinitionId: { teacherAssessmentId: ta2s2.id, promptDefinitionId: pdId } },
        update: {},
        create: { teacherAssessmentId: ta2s2.id, promptDefinitionId: pdId, score: std2Scores2[i] },
      })
    }

    const ta2s3 = assessmentByStd2A[3]!
    const pd2_31Id = promptDefMap['Ultimate Frisbee|3-1']
    if (pd2_31Id) {
      await db.teacherPromptScore.upsert({
        where: { teacherAssessmentId_promptDefinitionId: { teacherAssessmentId: ta2s3.id, promptDefinitionId: pd2_31Id } },
        update: {},
        create: { teacherAssessmentId: ta2s3.id, promptDefinitionId: pd2_31Id, score: 3 },
      })
    }

    const ta2s4 = assessmentByStd2A[4]!
    const pd2_41Id = promptDefMap['Ultimate Frisbee|4-1']
    if (pd2_41Id) {
      await db.teacherPromptScore.upsert({
        where: { teacherAssessmentId_promptDefinitionId: { teacherAssessmentId: ta2s4.id, promptDefinitionId: pd2_41Id } },
        update: {},
        create: { teacherAssessmentId: ta2s4.id, promptDefinitionId: pd2_41Id, score: 3 },
      })
    }
    await db.teacherStandard4Rating.upsert({
      where: { teacherAssessmentId: ta2s4.id },
      update: {},
      create: { teacherAssessmentId: ta2s4.id, rating: 2 },
    })

    const foundSnap2 = await db.gradeCalculationSnapshot.findFirst({
      where: { studentProfileId: alexId, historicalClassInstanceId: hci2AId },
    })
    foundSnap2 || await db.gradeCalculationSnapshot.create({
      data: {
        studentProfileId: alexId,
        historicalClassInstanceId: hci2AId,
        schoolYearId: schoolYear.id,
        standard1Score: 3.0,
        standard2Score: 2.5,
        standard3Score: 3.5,
        standard4Score: 3.0,
        overallAverage: 0.75,
        letterGrade: 'B+',
        snapshotData: { method: 'seed', activity: 'Ultimate Frisbee' },
      },
    })

    const foundAtl2 = await db.approachToLearningRecord.findUnique({
      where: { studentProfileId_historicalClassInstanceId: { studentProfileId: alexId, historicalClassInstanceId: hci2AId } },
    })
    foundAtl2 || await db.approachToLearningRecord.create({
      data: {
        studentProfileId: alexId,
        historicalClassInstanceId: hci2AId,
        teacherProfileId: michaelId,
        responsiblePrepared: 3,
        respectfulWorks: 4,
        effortTeacherScore: 3,
        effortStudentScore: 4,
        daysLateUnprepared: 1,
        // (3 + 4 + 3 + 4 + 3[daysLateScore]) / 5 = 3.4
        calculatedScore: 3.4,
      },
    })
  }
  log('Rotation 2: Alex Thompson fully graded (Ultimate Frisbee)')

  // -------------------------------------------------------------------------
  // Rotation 3 — Flag Football (ACTIVE, partial — 2 of 3 boys graded)
  // -------------------------------------------------------------------------
  if (hci3AId && michaelId) {
    const partialStudents = [
      {
        email: 'alex.thompson@micds.org',
        scores: [
          { std: 1, score: 2.5, feedback: 'Working on the drop-back and footwork on routes. Catching mechanics are solid.', visible: true },
          { std: 2, score: null, feedback: null, visible: false },
        ],
      },
      {
        email: 'jordan.williams@micds.org',
        scores: [
          { std: 1, score: 3.0, feedback: 'Good flag-pulling technique and positioning on defense.', visible: true },
        ],
      },
      // Casey Brown not yet graded
    ]

    for (const ps of partialStudents) {
      const sId = studentProfileMap[ps.email]
      if (!sId) continue
      for (const s of ps.scores) {
        if (s.score === null) continue
        const found = await db.teacherAssessment.findUnique({
          where: {
            teacherProfileId_historicalClassInstanceId_studentProfileId_standardNumber: {
              teacherProfileId: michaelId, historicalClassInstanceId: hci3AId, studentProfileId: sId, standardNumber: s.std,
            },
          },
        })
        found || await db.teacherAssessment.create({
          data: {
            teacherProfileId: michaelId, historicalClassInstanceId: hci3AId, studentProfileId: sId,
            standardNumber: s.std, score: s.score!, feedback: s.feedback, isFeedbackStudentVisible: s.visible,
          },
        })
      }
    }
  }
  log('Rotation 3: Flag Football partial grades entered (Alex + Jordan; Casey pending)')

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n=== Seed complete ===\n')
  console.log('Demo accounts (password: MICDS2024!, except admin below)')
  console.log('  Admin:    admin@micds.org (password: MICDS2026!)')
  console.log('  Teacher:  sarah.johnson@micds.org')
  console.log('  Teacher:  michael.chen@micds.org')
  console.log('  Student:  alex.thompson@micds.org')
  console.log('  Student:  jordan.williams@micds.org')
  console.log('  Student:  casey.brown@micds.org')
  console.log('  Student:  emma.davis@micds.org')
  console.log('  Student:  olivia.martinez@micds.org')
  console.log('  Student:  sophie.lee@micds.org')
  console.log('  Parent:   r.thompson@micds.org')
  console.log('')
}

main()
  .catch((e) => {
    console.error('\n[SEED ERROR]', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
