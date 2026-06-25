import { PrismaClient, Gender, GradeLevel, Role, AccountStatus, RotationStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const PASSWORD_HASH = bcrypt.hashSync('MICDS2024!', 12)

async function main() {
  console.log('🌱 Seeding MICDS PE grading database...')

  // ─────────────────────────── School Year ──────────────────────────────────
  const schoolYear = await db.schoolYear.upsert({
    where: { name: '2024-2025' },
    update: {},
    create: {
      name: '2024-2025',
      startDate: new Date('2024-08-26'),
      endDate: new Date('2025-06-05'),
      isActive: true,
    },
  })
  console.log('✓ School year created')

  // ─────────────────────────── Activity Templates ───────────────────────────
  const activities = [
    { name: 'Athletic Development', displayName: 'Athletic Development', gender: Gender.MALE, gradeLevel: GradeLevel.GRADE_6 },
    { name: 'Ultimate Frisbee', displayName: 'Ultimate Frisbee', gender: Gender.MALE, gradeLevel: GradeLevel.GRADE_6 },
    { name: 'Flag Football', displayName: 'Flag Football', gender: Gender.MALE, gradeLevel: GradeLevel.GRADE_6 },
    { name: 'Tennis', displayName: 'Tennis', gender: Gender.MALE, gradeLevel: GradeLevel.GRADE_6 },
    { name: 'Wrestling', displayName: 'Wrestling', gender: Gender.MALE, gradeLevel: GradeLevel.GRADE_6 },
    { name: 'Volleyball', displayName: 'Volleyball', gender: Gender.FEMALE, gradeLevel: GradeLevel.GRADE_6 },
    { name: 'Floor Hockey', displayName: 'Floor Hockey', gender: Gender.FEMALE, gradeLevel: GradeLevel.GRADE_6 },
    { name: 'Squash', displayName: 'Squash', gender: Gender.FEMALE, gradeLevel: GradeLevel.GRADE_6 },
    { name: 'Yoga', displayName: 'Yoga', gender: Gender.FEMALE, gradeLevel: GradeLevel.GRADE_6 },
  ]

  const activityMap: Record<string, string> = {}
  for (const act of activities) {
    const existing = await db.activityTemplate.findFirst({ where: { name: act.name, gender: act.gender, gradeLevel: act.gradeLevel } })
    const template = existing ?? await db.activityTemplate.create({
      data: { name: act.name, description: act.displayName, gender: act.gender, gradeLevel: act.gradeLevel },
    })
    activityMap[act.name] = template.id
  }
  console.log('✓ Activity templates created')

  // ─────────────────────────── Admin User ───────────────────────────────────
  const adminUser = await db.user.upsert({
    where: { email: 'admin@micds.org' },
    update: {},
    create: {
      email: 'admin@micds.org',
      passwordHash: PASSWORD_HASH,
      role: Role.ADMIN,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  })
  console.log('✓ Admin user created')

  // ─────────────────────────── Teacher Users ────────────────────────────────
  const teacherData = [
    { email: 'sarah.johnson@micds.org', firstName: 'Sarah', lastName: 'Johnson', employeeId: 'T001' },
    { email: 'michael.chen@micds.org', firstName: 'Michael', lastName: 'Chen', employeeId: 'T002' },
    { email: 'jessica.patel@micds.org', firstName: 'Jessica', lastName: 'Patel', employeeId: 'T003' },
    { email: 'david.garcia@micds.org', firstName: 'David', lastName: 'Garcia', employeeId: 'T004' },
    { email: 'emily.brooks@micds.org', firstName: 'Emily', lastName: 'Brooks', employeeId: 'T005' },
  ]

  const teacherProfiles: Record<string, string> = {}
  for (const t of teacherData) {
    const user = await db.user.upsert({
      where: { email: t.email },
      update: {},
      create: {
        email: t.email,
        passwordHash: PASSWORD_HASH,
        role: Role.TEACHER,
        status: AccountStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    })
    const existing = await db.teacherProfile.findUnique({ where: { userId: user.id } })
    const profile = existing ?? await db.teacherProfile.create({
      data: {
        userId: user.id,
        firstName: t.firstName,
        lastName: t.lastName,
        employeeId: t.employeeId,
      },
    })
    teacherProfiles[t.email] = profile.id
  }
  console.log('✓ Teacher users and profiles created')

  // ─────────────────────────── Student Users ────────────────────────────────
  const studentData = [
    // Boys Group A
    { email: 'alex.thompson@micds.org', firstName: 'Alex', lastName: 'Thompson', gender: Gender.MALE, gradeLevel: GradeLevel.GRADE_6, studentId: 'S001', group: 'A' },
    { email: 'jordan.williams@micds.org', firstName: 'Jordan', lastName: 'Williams', gender: Gender.MALE, gradeLevel: GradeLevel.GRADE_6, studentId: 'S002', group: 'A' },
    { email: 'casey.brown@micds.org', firstName: 'Casey', lastName: 'Brown', gender: Gender.MALE, gradeLevel: GradeLevel.GRADE_6, studentId: 'S003', group: 'A' },
    { email: 'mason.davis@micds.org', firstName: 'Mason', lastName: 'Davis', gender: Gender.MALE, gradeLevel: GradeLevel.GRADE_6, studentId: 'S004', group: 'A' },
    // Girls Group B
    { email: 'emma.davis@micds.org', firstName: 'Emma', lastName: 'Davis', gender: Gender.FEMALE, gradeLevel: GradeLevel.GRADE_6, studentId: 'S005', group: 'B' },
    { email: 'olivia.martinez@micds.org', firstName: 'Olivia', lastName: 'Martinez', gender: Gender.FEMALE, gradeLevel: GradeLevel.GRADE_6, studentId: 'S006', group: 'B' },
    { email: 'sophie.lee@micds.org', firstName: 'Sophie', lastName: 'Lee', gender: Gender.FEMALE, gradeLevel: GradeLevel.GRADE_6, studentId: 'S007', group: 'B' },
    { email: 'ava.wilson@micds.org', firstName: 'Ava', lastName: 'Wilson', gender: Gender.FEMALE, gradeLevel: GradeLevel.GRADE_6, studentId: 'S008', group: 'B' },
  ]

  const studentProfiles: Record<string, string> = {}
  for (const s of studentData) {
    const user = await db.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        passwordHash: PASSWORD_HASH,
        role: Role.STUDENT,
        status: AccountStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    })
    const existing = await db.studentProfile.findUnique({ where: { userId: user.id } })
    const profile = existing ?? await db.studentProfile.create({
      data: {
        userId: user.id,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        gradeLevel: s.gradeLevel,
        studentId: s.studentId,
      },
    })
    studentProfiles[s.email] = profile.id
  }
  console.log('✓ Student users and profiles created')

  // ─────────────────────────── Parent User ──────────────────────────────────
  const parentUser = await db.user.upsert({
    where: { email: 'r.thompson@micds.org' },
    update: {},
    create: {
      email: 'r.thompson@micds.org',
      passwordHash: PASSWORD_HASH,
      role: Role.PARENT,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  })
  const existingParent = await db.parentProfile.findUnique({ where: { userId: parentUser.id } })
  const parentProfile = existingParent ?? await db.parentProfile.create({
    data: { userId: parentUser.id, firstName: 'Robert', lastName: 'Thompson' },
  })
  // Link parent to Alex Thompson
  const alexProfile = studentProfiles['alex.thompson@micds.org']
  if (alexProfile) {
    await db.parentStudentLink.upsert({
      where: { parentProfileId_studentProfileId: { parentProfileId: parentProfile.id, studentProfileId: alexProfile } },
      update: {},
      create: { parentProfileId: parentProfile.id, studentProfileId: alexProfile, createdBy: adminUser.id },
    })
  }
  console.log('✓ Parent user and student link created')

  // ─────────────────────────── Student Groups ───────────────────────────────
  const groupA = await db.studentGroup.upsert({
    where: { schoolYearId_name: { schoolYearId: schoolYear.id, name: '6th Grade Boys - Group A' } },
    update: {},
    create: {
      schoolYearId: schoolYear.id,
      name: '6th Grade Boys - Group A',
      gradeLevel: GradeLevel.GRADE_6,
      gender: Gender.MALE,
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
    },
  })

  // Add students to groups
  const boysEmails = ['alex.thompson@micds.org', 'jordan.williams@micds.org', 'casey.brown@micds.org', 'mason.davis@micds.org']
  const girlsEmails = ['emma.davis@micds.org', 'olivia.martinez@micds.org', 'sophie.lee@micds.org', 'ava.wilson@micds.org']

  for (const email of boysEmails) {
    const sid = studentProfiles[email]
    if (sid) {
      await db.studentGroupMembership.upsert({
        where: { studentGroupId_studentProfileId: { studentGroupId: groupA.id, studentProfileId: sid } },
        update: {},
        create: { studentGroupId: groupA.id, studentProfileId: sid },
      })
    }
  }
  for (const email of girlsEmails) {
    const sid = studentProfiles[email]
    if (sid) {
      await db.studentGroupMembership.upsert({
        where: { studentGroupId_studentProfileId: { studentGroupId: groupB.id, studentProfileId: sid } },
        update: {},
        create: { studentGroupId: groupB.id, studentProfileId: sid },
      })
    }
  }
  console.log('✓ Student groups and memberships created')

  // ─────────────────────────── Teacher Class Assignments ────────────────────
  const tcaMap: Record<string, string> = {}

  // Boys activities -> Sarah Johnson and Michael Chen alternating
  const boysActivities = ['Athletic Development', 'Flag Football', 'Tennis', 'Ultimate Frisbee', 'Wrestling']
  const girlsActivities = ['Volleyball', 'Floor Hockey', 'Squash', 'Yoga']

  const teacherIds = {
    sarah: teacherProfiles['sarah.johnson@micds.org'],
    michael: teacherProfiles['michael.chen@micds.org'],
    jessica: teacherProfiles['jessica.patel@micds.org'],
    david: teacherProfiles['david.garcia@micds.org'],
    emily: teacherProfiles['emily.brooks@micds.org'],
  }

  // Assign teachers to activities
  const activityTeacherMap: Record<string, string> = {
    'Athletic Development': teacherIds.sarah,
    'Flag Football': teacherIds.michael,
    'Tennis': teacherIds.sarah,
    'Ultimate Frisbee': teacherIds.michael,
    'Wrestling': teacherIds.david,
    'Volleyball': teacherIds.jessica,
    'Floor Hockey': teacherIds.emily,
    'Squash': teacherIds.jessica,
    'Yoga': teacherIds.emily,
  }

  for (const [actName, teacherId] of Object.entries(activityTeacherMap)) {
    const actId = activityMap[actName]
    if (!actId || !teacherId) continue
    const existing = await db.teacherClassAssignment.findFirst({
      where: { teacherProfileId: teacherId, activityTemplateId: actId, schoolYearId: schoolYear.id },
    })
    const tca = existing ?? await db.teacherClassAssignment.create({
      data: { teacherProfileId: teacherId, activityTemplateId: actId, schoolYearId: schoolYear.id },
    })
    tcaMap[actName] = tca.id
  }
  console.log('✓ Teacher class assignments created')

  // ─────────────────────────── Carousel Plan ────────────────────────────────
  const existingPlan = await db.carouselPlan.findFirst({ where: { schoolYearId: schoolYear.id, isActive: true } })
  const plan = existingPlan ?? await db.carouselPlan.create({
    data: {
      schoolYearId: schoolYear.id,
      name: '2024-2025 Boys 6th Grade Carousel',
      isActive: true,
      createdBy: adminUser.id,
    },
  })

  // Create 5 carousel positions for boys (we'll do boys group only for simplicity)
  const boysCarouselOrder = ['Athletic Development', 'Flag Football', 'Tennis', 'Ultimate Frisbee', 'Wrestling']
  for (let i = 0; i < boysCarouselOrder.length; i++) {
    const actName = boysCarouselOrder[i]
    const tcaId = tcaMap[actName]
    if (!tcaId) continue
    await db.carouselPosition.upsert({
      where: { carouselPlanId_positionOrder: { carouselPlanId: plan.id, positionOrder: i + 1 } },
      update: {},
      create: { carouselPlanId: plan.id, positionOrder: i + 1, teacherClassAssignmentId: tcaId },
    })
  }
  console.log('✓ Carousel plan and positions created')

  // ─────────────────────────── Rotation Assignments ─────────────────────────
  const positions = await db.carouselPosition.findMany({ where: { carouselPlanId: plan.id }, orderBy: { positionOrder: 'asc' } })

  // Rotation 1: Athletic Development (LOCKED) - Sep 2024
  const rot1Start = new Date('2024-09-03')
  const rot1End = new Date('2024-10-04')
  const rot1 = await db.groupRotationAssignment.upsert({
    where: { studentGroupId_carouselPositionId_rotationNumber: { studentGroupId: groupA.id, carouselPositionId: positions[0].id, rotationNumber: 1 } },
    update: {},
    create: {
      schoolYearId: schoolYear.id,
      studentGroupId: groupA.id,
      carouselPositionId: positions[0].id,
      startDate: rot1Start,
      endDate: rot1End,
      status: RotationStatus.LOCKED,
      rotationNumber: 1,
    },
  })

  // Rotation 2: Flag Football (ACTIVE) - Oct 2024
  const rot2Start = new Date('2024-10-07')
  const rot2End = new Date('2024-11-08')
  const rot2 = await db.groupRotationAssignment.upsert({
    where: { studentGroupId_carouselPositionId_rotationNumber: { studentGroupId: groupA.id, carouselPositionId: positions[1].id, rotationNumber: 2 } },
    update: {},
    create: {
      schoolYearId: schoolYear.id,
      studentGroupId: groupA.id,
      carouselPositionId: positions[1].id,
      startDate: rot2Start,
      endDate: rot2End,
      status: RotationStatus.ACTIVE,
      rotationNumber: 2,
    },
  })

  // Rotations 3-5: UPCOMING
  const upcomingDates = [
    { start: new Date('2024-11-11'), end: new Date('2024-12-13') },
    { start: new Date('2025-01-06'), end: new Date('2025-02-07') },
    { start: new Date('2025-02-10'), end: new Date('2025-03-14') },
  ]

  for (let i = 0; i < 3; i++) {
    await db.groupRotationAssignment.upsert({
      where: { studentGroupId_carouselPositionId_rotationNumber: { studentGroupId: groupA.id, carouselPositionId: positions[i + 2].id, rotationNumber: i + 3 } },
      update: {},
      create: {
        schoolYearId: schoolYear.id,
        studentGroupId: groupA.id,
        carouselPositionId: positions[i + 2].id,
        startDate: upcomingDates[i].start,
        endDate: upcomingDates[i].end,
        status: RotationStatus.UPCOMING,
        rotationNumber: i + 3,
      },
    })
  }
  console.log('✓ Rotation assignments created')

  // ─────────────────────────── Historical Class Instances ───────────────────
  // Instance for rotation 1 (LOCKED)
  const inst1Tca = tcaMap['Athletic Development']
  const inst1 = await db.historicalClassInstance.upsert({
    where: { groupRotationAssignmentId_studentGroupId_teacherClassAssignmentId: {
      groupRotationAssignmentId: rot1.id,
      studentGroupId: groupA.id,
      teacherClassAssignmentId: inst1Tca,
    }},
    update: {},
    create: {
      groupRotationAssignmentId: rot1.id,
      studentGroupId: groupA.id,
      teacherClassAssignmentId: inst1Tca,
      schoolYearId: schoolYear.id,
      status: RotationStatus.LOCKED,
      lockedAt: rot1End,
      lockedBy: adminUser.id,
    },
  })

  // Instance for rotation 2 (ACTIVE)
  const inst2Tca = tcaMap['Flag Football']
  const inst2 = await db.historicalClassInstance.upsert({
    where: { groupRotationAssignmentId_studentGroupId_teacherClassAssignmentId: {
      groupRotationAssignmentId: rot2.id,
      studentGroupId: groupA.id,
      teacherClassAssignmentId: inst2Tca,
    }},
    update: {},
    create: {
      groupRotationAssignmentId: rot2.id,
      studentGroupId: groupA.id,
      teacherClassAssignmentId: inst2Tca,
      schoolYearId: schoolYear.id,
      status: RotationStatus.ACTIVE,
    },
  })
  console.log('✓ Historical class instances created')

  // ─────────────────────────── Sample Grades ────────────────────────────────
  // Grade Alex Thompson in rotation 1 (Athletic Development - LOCKED)
  const alexId = studentProfiles['alex.thompson@micds.org']
  const sarahId = teacherProfiles['sarah.johnson@micds.org']

  if (alexId && sarahId) {
    // Teacher assessment for Standard 1
    const existingAssessment = await db.teacherAssessment.findFirst({
      where: { teacherProfileId: sarahId, studentProfileId: alexId, historicalClassInstanceId: inst1.id, standardNumber: 1 },
    })
    const assessment1 = existingAssessment ?? await db.teacherAssessment.create({
      data: {
        teacherProfileId: sarahId,
        studentProfileId: alexId,
        historicalClassInstanceId: inst1.id,
        standardNumber: 1,
        skillScores: { 'Squat': 4, 'Lateral Lunge': 3, 'Hip Hinge/RDL': 4, 'Horizontal Press (Push-Up)': 3, 'Vertical Pull (Flexed-Arm Hang)': 3, 'Core Stability (Plank)': 4 },
        writtenScore: 3.5,
        notes: 'Alex shows excellent form in the squat and hip hinge. Keep working on the lateral lunge and vertical pull.',
        isStudentVisible: true,
      },
    })

    // Standard 2
    const existingA2 = await db.teacherAssessment.findFirst({
      where: { teacherProfileId: sarahId, studentProfileId: alexId, historicalClassInstanceId: inst1.id, standardNumber: 2 },
    })
    existingA2 || await db.teacherAssessment.create({
      data: {
        teacherProfileId: sarahId,
        studentProfileId: alexId,
        historicalClassInstanceId: inst1.id,
        standardNumber: 2,
        skillScores: {},
        writtenScore: 3.0,
        notes: 'Good understanding of the concepts covered in Athletic Development.',
        isStudentVisible: true,
      },
    })

    // Standard 3
    const existingA3 = await db.teacherAssessment.findFirst({
      where: { teacherProfileId: sarahId, studentProfileId: alexId, historicalClassInstanceId: inst1.id, standardNumber: 3 },
    })
    existingA3 || await db.teacherAssessment.create({
      data: {
        teacherProfileId: sarahId,
        studentProfileId: alexId,
        historicalClassInstanceId: inst1.id,
        standardNumber: 3,
        skillScores: {},
        writtenScore: 2.5,
        notes: 'Developing understanding of health and fitness concepts.',
        isStudentVisible: false,
      },
    })

    // Standard 4
    const existingA4 = await db.teacherAssessment.findFirst({
      where: { teacherProfileId: sarahId, studentProfileId: alexId, historicalClassInstanceId: inst1.id, standardNumber: 4 },
    })
    existingA4 || await db.teacherAssessment.create({
      data: {
        teacherProfileId: sarahId,
        studentProfileId: alexId,
        historicalClassInstanceId: inst1.id,
        standardNumber: 4,
        skillScores: {},
        writtenScore: 3.0,
        notes: 'Alex is a positive team member and encourages peers.',
        isStudentVisible: true,
      },
    })

    // Grade snapshot for rotation 1
    const existingSnap = await db.gradeCalculationSnapshot.findFirst({
      where: { studentProfileId: alexId, historicalClassInstanceId: inst1.id },
    })
    existingSnap || await db.gradeCalculationSnapshot.create({
      data: {
        studentProfileId: alexId,
        historicalClassInstanceId: inst1.id,
        schoolYearId: schoolYear.id,
        standard1Score: 3.5,
        standard2Score: 3.0,
        standard3Score: 2.5,
        standard4Score: 3.0,
        overallAverage: 0.8625,
        letterGrade: 'B+',
        snapshotData: { calculatedAt: new Date().toISOString(), method: 'seed' },
      },
    })

    // ATL record
    const existingAtl = await db.approachToLearningRecord.findFirst({
      where: { studentProfileId: alexId, historicalClassInstanceId: inst1.id },
    })
    existingAtl || await db.approachToLearningRecord.create({
      data: {
        studentProfileId: alexId,
        historicalClassInstanceId: inst1.id,
        teacherProfileId: sarahId,
        responsiblePrepared: 4,
        respectfulWorks: 4,
        effortToLearn: 4,
        daysLateUnprepared: 0,
        calculatedScore: 4.0,
      },
    })
  }
  console.log('✓ Sample grades and ATL records created')

  // ─────────────────────────── Sample Submission ────────────────────────────
  const alexId2 = studentProfiles['alex.thompson@micds.org']
  if (alexId2) {
    const existingSub = await db.studentSubmission.findFirst({
      where: { studentProfileId: alexId2, historicalClassInstanceId: inst1.id, standardNumber: 2 },
    })
    existingSub || await db.studentSubmission.create({
      data: {
        studentProfileId: alexId2,
        historicalClassInstanceId: inst1.id,
        standardNumber: 2,
        status: 'SUBMITTED',
        responses: {
          'q1': 'Athletic development is important because it builds foundational movement patterns that help in all sports and daily activities.',
          'q2': 'I can improve my performance by practicing the skills we learned and focusing on proper form.',
        },
        honorCodeAcknowledged: true,
        honorCodeAt: new Date('2024-09-20'),
      },
    })
  }
  console.log('✓ Sample student submission created')

  console.log('\n✅ Seed complete!')
  console.log('\nDemo accounts (password: MICDS2024!):')
  console.log('  Admin:    admin@micds.org')
  console.log('  Teacher:  sarah.johnson@micds.org')
  console.log('  Teacher:  michael.chen@micds.org')
  console.log('  Student:  alex.thompson@micds.org')
  console.log('  Student:  emma.davis@micds.org')
  console.log('  Parent:   r.thompson@micds.org')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
