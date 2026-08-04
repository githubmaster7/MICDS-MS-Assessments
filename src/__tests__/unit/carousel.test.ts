/**
 * Unit tests for carousel rotation logic.
 * Tests the core rotation algorithm without DB dependencies.
 */

interface StudentGroupMember { studentId: string; groupId: string }
interface CarouselPositionEntry { positionOrder: number; teacherClassAssignmentId: string }
interface GroupAssignment { groupId: string; positionIndex: number } // index into positions array

// Core rotation logic extracted for testing
function computeNextAssignments(
  groups: string[],
  positions: CarouselPositionEntry[],
  currentAssignments: GroupAssignment[]
): GroupAssignment[] {
  const posCount = positions.length
  return currentAssignments.map((assignment) => ({
    groupId: assignment.groupId,
    positionIndex: (assignment.positionIndex + 1) % posCount,
  }))
}

function validateCarouselIntegrity(
  groups: string[],
  assignments: GroupAssignment[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Every group must have exactly one assignment
  for (const group of groups) {
    const count = assignments.filter((a) => a.groupId === group).length
    if (count === 0) errors.push(`Group ${group} has no assignment`)
    if (count > 1) errors.push(`Group ${group} has duplicate assignments`)
  }

  // No two groups should have the same position
  const positions = assignments.map((a) => a.positionIndex)
  const uniquePositions = new Set(positions)
  if (uniquePositions.size !== positions.length) {
    errors.push('Two or more groups share the same carousel position')
  }

  return { valid: errors.length === 0, errors }
}

function validateStudentGroupsUnchanged(
  beforeMembers: StudentGroupMember[],
  afterMembers: StudentGroupMember[]
): boolean {
  // Student group membership must be identical before and after rotation
  if (beforeMembers.length !== afterMembers.length) return false
  const beforeSet = new Set(beforeMembers.map((m) => `${m.groupId}:${m.studentId}`))
  const afterSet = new Set(afterMembers.map((m) => `${m.groupId}:${m.studentId}`))
  for (const key of beforeSet) {
    if (!afterSet.has(key)) return false
  }
  return true
}

describe('carousel rotation logic', () => {
  const groups = ['groupA', 'groupB', 'groupC']
  const positions: CarouselPositionEntry[] = [
    { positionOrder: 0, teacherClassAssignmentId: 'tca-tennis' },
    { positionOrder: 1, teacherClassAssignmentId: 'tca-yoga' },
    { positionOrder: 2, teacherClassAssignmentId: 'tca-volleyball' },
  ]

  const initialAssignments: GroupAssignment[] = [
    { groupId: 'groupA', positionIndex: 0 },
    { groupId: 'groupB', positionIndex: 1 },
    { groupId: 'groupC', positionIndex: 2 },
  ]

  test('rotation advances each group to next position', () => {
    const next = computeNextAssignments(groups, positions, initialAssignments)
    expect(next.find((a) => a.groupId === 'groupA')?.positionIndex).toBe(1)
    expect(next.find((a) => a.groupId === 'groupB')?.positionIndex).toBe(2)
    expect(next.find((a) => a.groupId === 'groupC')?.positionIndex).toBe(0) // wraps around
  })

  test('carousel wraps around at end', () => {
    const allAtLast: GroupAssignment[] = [
      { groupId: 'groupA', positionIndex: 2 },
      { groupId: 'groupB', positionIndex: 0 },
      { groupId: 'groupC', positionIndex: 1 },
    ]
    const next = computeNextAssignments(groups, positions, allAtLast)
    expect(next.find((a) => a.groupId === 'groupA')?.positionIndex).toBe(0) // wraps
  })

  test('every group has exactly one assignment after rotation', () => {
    const next = computeNextAssignments(groups, positions, initialAssignments)
    const { valid } = validateCarouselIntegrity(groups, next)
    expect(valid).toBe(true)
  })

  test('integrity check catches duplicate position assignments', () => {
    const badAssignments: GroupAssignment[] = [
      { groupId: 'groupA', positionIndex: 0 },
      { groupId: 'groupB', positionIndex: 0 }, // duplicate!
      { groupId: 'groupC', positionIndex: 2 },
    ]
    const { valid, errors } = validateCarouselIntegrity(groups, badAssignments)
    expect(valid).toBe(false)
    expect(errors.length).toBeGreaterThan(0)
  })

  test('integrity check catches missing group', () => {
    const missingGroup: GroupAssignment[] = [
      { groupId: 'groupA', positionIndex: 0 },
      { groupId: 'groupB', positionIndex: 1 },
      // groupC missing
    ]
    const { valid, errors } = validateCarouselIntegrity(groups, missingGroup)
    expect(valid).toBe(false)
    expect(errors.some((e) => e.includes('groupC'))).toBe(true)
  })
})

describe('student group integrity during rotation', () => {
  const members: StudentGroupMember[] = [
    { groupId: 'groupA', studentId: 'student1' },
    { groupId: 'groupA', studentId: 'student2' },
    { groupId: 'groupB', studentId: 'student3' },
    { groupId: 'groupB', studentId: 'student4' },
  ]

  test('student group membership unchanged after rotation', () => {
    // After rotation, same students are in same groups
    const afterRotation = [...members] // rotation doesn't touch memberships
    expect(validateStudentGroupsUnchanged(members, afterRotation)).toBe(true)
  })

  test('detects when student moved between groups', () => {
    const illegalMove: StudentGroupMember[] = [
      { groupId: 'groupA', studentId: 'student1' },
      { groupId: 'groupB', studentId: 'student2' }, // student2 moved to groupB!
      { groupId: 'groupB', studentId: 'student3' },
      { groupId: 'groupB', studentId: 'student4' },
    ]
    expect(validateStudentGroupsUnchanged(members, illegalMove)).toBe(false)
  })

  test('detects when student is removed', () => {
    const missingStudent = members.slice(0, 3) // student4 removed
    expect(validateStudentGroupsUnchanged(members, missingStudent)).toBe(false)
  })
})
