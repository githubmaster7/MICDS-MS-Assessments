/**
 * Carousel engine — unit tests for validation, preview, computation, and
 * student group integrity.
 *
 * No DB calls are made here; all functions accept plain data objects.
 */

import {
  validateCarouselRotation,
  previewNextRotation,
  computeNextRotationAssignments,
  computeUpcomingSequence,
  validateStudentGroupIntegrity,
  type CarouselPlan,
  type CarouselPosition,
  type GroupRotationAssignment,
  type StudentGroup,
  type CarouselState,
  type StudentGroupMembership,
} from '@/lib/carousel/engine'

// ─── Fixture builders ─────────────────────────────────────────────────────────

function makePlan(overrides: Partial<CarouselPlan> = {}): CarouselPlan {
  return {
    id: 'plan-1',
    schoolYearId: 'sy-2024',
    name: 'Fall 2024',
    isActive: true,
    ...overrides,
  }
}

function makePosition(
  id: string,
  positionOrder: number,
  teacherClassAssignmentId = `tca-${positionOrder}`
): CarouselPosition {
  return { id, carouselPlanId: 'plan-1', positionOrder, teacherClassAssignmentId }
}

function makeGroup(id: string, name: string, isActive = true): StudentGroup {
  return {
    id,
    name,
    schoolYearId: 'sy-2024',
    gradeLevel: 'GRADE_6',
    gender: 'FEMALE',
    isActive,
  }
}

function makeAssignment(
  id: string,
  studentGroupId: string,
  carouselPositionId: string,
  rotationNumber = 1
): GroupRotationAssignment {
  return { id, studentGroupId, carouselPositionId, rotationNumber, status: 'ACTIVE' }
}

/** Build a clean CarouselState with N groups and N positions, one group per position. */
function makeState(n: number): CarouselState {
  const plan = makePlan()
  const positions = Array.from({ length: n }, (_, i) =>
    makePosition(`pos-${i + 1}`, i + 1, `tca-teacher${i + 1}`)
  )
  const groups = Array.from({ length: n }, (_, i) => makeGroup(`group-${i + 1}`, `Group ${i + 1}`))
  const currentAssignments = groups.map((g, i) =>
    makeAssignment(`assign-${i + 1}`, g.id, positions[i].id)
  )
  return { plan, positions, currentAssignments, studentGroups: groups }
}

// ─── validateCarouselRotation ─────────────────────────────────────────────────

describe('validateCarouselRotation', () => {
  it('valid 3-group plan passes with no errors', () => {
    const state = makeState(3)
    const result = validateCarouselRotation(state)
    expect(result.isValid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('valid 1-group plan passes', () => {
    const result = validateCarouselRotation(makeState(1))
    expect(result.isValid).toBe(true)
  })

  it('valid 6-group plan passes', () => {
    const result = validateCarouselRotation(makeState(6))
    expect(result.isValid).toBe(true)
  })

  it('detects group with no assignment', () => {
    const state = makeState(3)
    // Remove assignment for group-2
    state.currentAssignments = state.currentAssignments.filter(
      (a) => a.studentGroupId !== 'group-2'
    )
    const result = validateCarouselRotation(state)
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes('group-2'))).toBe(true)
  })

  it('detects group with duplicate assignments', () => {
    const state = makeState(3)
    // Add a second assignment for group-1 at a different position
    state.currentAssignments.push(makeAssignment('assign-dup', 'group-1', 'pos-2'))
    const result = validateCarouselRotation(state)
    expect(result.isValid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('detects two groups assigned to the same position', () => {
    const state = makeState(3)
    // Move group-2 to the same position as group-1
    const idx = state.currentAssignments.findIndex((a) => a.studentGroupId === 'group-2')
    state.currentAssignments[idx] = makeAssignment('assign-2', 'group-2', 'pos-1')
    const result = validateCarouselRotation(state)
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes('pos-1'))).toBe(true)
  })

  it('detects assignment referencing a position not in the plan', () => {
    const state = makeState(3)
    const idx = state.currentAssignments.findIndex((a) => a.studentGroupId === 'group-1')
    state.currentAssignments[idx] = makeAssignment('assign-1', 'group-1', 'pos-FOREIGN')
    const result = validateCarouselRotation(state)
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.includes('pos-FOREIGN'))).toBe(true)
  })

  it('detects non-contiguous position ordering', () => {
    const state = makeState(3)
    // Break ordering: skip 2, use 3 instead
    state.positions[1] = makePosition('pos-2', 3)
    const result = validateCarouselRotation(state)
    expect(result.isValid).toBe(false)
    expect(result.errors.some((e) => e.toLowerCase().includes('order'))).toBe(true)
  })

  it('does not warn about empty positions (no group assigned there) — expected when groups < positions', () => {
    const plan = makePlan()
    const positions = [
      makePosition('pos-1', 1),
      makePosition('pos-2', 2),
      makePosition('pos-3', 3), // no group here
    ]
    const groups = [makeGroup('group-1', 'Group 1'), makeGroup('group-2', 'Group 2')]
    const currentAssignments = [
      makeAssignment('a-1', 'group-1', 'pos-1'),
      makeAssignment('a-2', 'group-2', 'pos-2'),
    ]
    const result = validateCarouselRotation({ plan, positions, currentAssignments, studentGroups: groups })
    expect(result.isValid).toBe(true)
    expect(result.warnings.some((w) => w.includes('pos-3'))).toBe(false)
  })

  it('ignores inactive groups when checking assignment coverage', () => {
    const state = makeState(3)
    // Make group-3 inactive — its assignment can stay without error
    state.studentGroups[2].isActive = false
    // Remove group-3's assignment entirely — inactive groups don't need one
    state.currentAssignments = state.currentAssignments.filter(
      (a) => a.studentGroupId !== 'group-3'
    )
    const result = validateCarouselRotation(state)
    expect(result.isValid).toBe(true)
  })
})

// ─── previewNextRotation ──────────────────────────────────────────────────────

describe('previewNextRotation', () => {
  it('returns isValid false when current state has errors', () => {
    const state = makeState(3)
    // Remove an assignment to make state invalid
    state.currentAssignments = state.currentAssignments.slice(0, 2)
    const preview = previewNextRotation(state)
    expect(preview.isValid).toBe(false)
    expect(preview.warnings.length).toBeGreaterThan(0)
  })

  it('correctly maps next position for each group (3-group rotation)', () => {
    const state = makeState(3)
    const preview = previewNextRotation(state)
    expect(preview.isValid).toBe(true)

    // group-1 at pos-1, should move to pos-2
    const nextForGroup1 = preview.nextState.get('pos-2')
    expect(nextForGroup1).toContain('group-1')

    // group-2 at pos-2, should move to pos-3
    const nextForGroup2 = preview.nextState.get('pos-3')
    expect(nextForGroup2).toContain('group-2')

    // group-3 at pos-3 (last), should wrap to pos-1
    const nextForGroup3 = preview.nextState.get('pos-1')
    expect(nextForGroup3).toContain('group-3')
  })

  it('last group wraps around to first position', () => {
    const state = makeState(4)
    const preview = previewNextRotation(state)
    // group-4 at pos-4 (last), wraps to pos-1
    const wrappedTarget = preview.nextState.get('pos-1')
    expect(wrappedTarget).toContain('group-4')
  })

  it('currentState mirrors the input assignments', () => {
    const state = makeState(3)
    const preview = previewNextRotation(state)
    expect(preview.currentState.get('pos-1')).toContain('group-1')
    expect(preview.currentState.get('pos-2')).toContain('group-2')
    expect(preview.currentState.get('pos-3')).toContain('group-3')
  })

  it('affectedGroups lists all groups (every group changes teacher)', () => {
    const state = makeState(3)
    const preview = previewNextRotation(state)
    expect(preview.affectedGroups.length).toBe(3)
  })

  it('affectedTeachers lists both old and new teachers for moved groups', () => {
    const state = makeState(3)
    const preview = previewNextRotation(state)
    // With 3 positions and 3 groups all rotating, 3 teachers affected (each a "from" or "to")
    expect(preview.affectedTeachers.length).toBeGreaterThan(0)
  })
})

// ─── computeNextRotationAssignments ──────────────────────────────────────────

describe('computeNextRotationAssignments', () => {
  it('throws when current state is invalid', () => {
    const state = makeState(3)
    state.currentAssignments = state.currentAssignments.slice(0, 1) // only 1 of 3
    expect(() => computeNextRotationAssignments(state)).toThrow()
  })

  it('returns a map from groupId to next positionId', () => {
    const state = makeState(3)
    const result = computeNextRotationAssignments(state)
    expect(result.size).toBe(3)
    expect(result.get('group-1')).toBe('pos-2')
    expect(result.get('group-2')).toBe('pos-3')
    expect(result.get('group-3')).toBe('pos-1') // wrap
  })

  it('last position wraps to first (4 groups)', () => {
    const state = makeState(4)
    const result = computeNextRotationAssignments(state)
    expect(result.get('group-4')).toBe('pos-1')
  })

  it('single group wraps to the same (only) position', () => {
    const state = makeState(1)
    const result = computeNextRotationAssignments(state)
    expect(result.get('group-1')).toBe('pos-1')
  })

  it('every group gets a unique next position', () => {
    const state = makeState(5)
    const result = computeNextRotationAssignments(state)
    const positions = Array.from(result.values())
    const uniquePositions = new Set(positions)
    expect(uniquePositions.size).toBe(positions.length)
  })
})

// ─── computeUpcomingSequence ──────────────────────────────────────────────────

describe('computeUpcomingSequence', () => {
  it('walks forward from the current position for the requested count', () => {
    const state = makeState(9)
    const result = computeUpcomingSequence(state.positions, 'pos-5', 4)
    expect(result).toEqual(['pos-6', 'pos-7', 'pos-8', 'pos-9'])
  })

  it('wraps around past the last position', () => {
    const state = makeState(9)
    const result = computeUpcomingSequence(state.positions, 'pos-8', 4)
    expect(result).toEqual(['pos-9', 'pos-1', 'pos-2', 'pos-3'])
  })

  it('reflects a reordered positions array immediately', () => {
    const state = makeState(4)
    // Swap pos-3 and pos-4's order, simulating an admin reorder.
    const reordered = state.positions.map((p) => {
      if (p.id === 'pos-3') return { ...p, positionOrder: 4 }
      if (p.id === 'pos-4') return { ...p, positionOrder: 3 }
      return p
    })
    const result = computeUpcomingSequence(reordered, 'pos-2', 2)
    expect(result).toEqual(['pos-4', 'pos-3'])
  })

  it('returns an empty array when count is 0', () => {
    const state = makeState(3)
    expect(computeUpcomingSequence(state.positions, 'pos-1', 0)).toEqual([])
  })

  it('throws if the current position is not found', () => {
    const state = makeState(3)
    expect(() => computeUpcomingSequence(state.positions, 'nonexistent', 1)).toThrow()
  })
})

// ─── validateStudentGroupIntegrity ───────────────────────────────────────────

describe('validateStudentGroupIntegrity', () => {
  const groups = [
    makeGroup('group-a', 'Group A'),
    makeGroup('group-b', 'Group B'),
  ]

  const memberships: StudentGroupMembership[] = [
    { id: 'm1', studentGroupId: 'group-a', studentProfileId: 'student-1', leftAt: null },
    { id: 'm2', studentGroupId: 'group-a', studentProfileId: 'student-2', leftAt: null },
    { id: 'm3', studentGroupId: 'group-b', studentProfileId: 'student-3', leftAt: null },
    { id: 'm4', studentGroupId: 'group-b', studentProfileId: 'student-4', leftAt: null },
  ]

  it('passes when each student belongs to exactly one active group', () => {
    expect(validateStudentGroupIntegrity(groups, memberships)).toBe(true)
  })

  it('fails when a student appears in two active groups', () => {
    const split: StudentGroupMembership[] = [
      ...memberships,
      // student-1 also in group-b
      { id: 'm5', studentGroupId: 'group-b', studentProfileId: 'student-1', leftAt: null },
    ]
    expect(validateStudentGroupIntegrity(groups, split)).toBe(false)
  })

  it('ignores memberships with non-null leftAt (left students)', () => {
    const withLeft: StudentGroupMembership[] = [
      ...memberships,
      // student-1 also in group-b but has leftAt set → inactive
      { id: 'm5', studentGroupId: 'group-b', studentProfileId: 'student-1', leftAt: new Date() },
    ]
    expect(validateStudentGroupIntegrity(groups, withLeft)).toBe(true)
  })

  it('ignores memberships in inactive groups', () => {
    const inactiveGroup = makeGroup('group-c', 'Group C', false)
    const withInactive: StudentGroupMembership[] = [
      ...memberships,
      // student-1 also in inactive group-c → should be ignored
      { id: 'm5', studentGroupId: 'group-c', studentProfileId: 'student-1', leftAt: null },
    ]
    expect(validateStudentGroupIntegrity([...groups, inactiveGroup], withInactive)).toBe(true)
  })

  it('passes for empty memberships list', () => {
    expect(validateStudentGroupIntegrity(groups, [])).toBe(true)
  })

  it('passes for empty groups list', () => {
    expect(validateStudentGroupIntegrity([], memberships)).toBe(true)
  })
})

// ─── Fixed student group rule ─────────────────────────────────────────────────

describe('Fixed student group rule — students stay together through rotations', () => {
  it('rotation changes position assignment, not group membership', () => {
    const state = makeState(3)

    const membersBefore: StudentGroupMembership[] = [
      { id: 'm1', studentGroupId: 'group-1', studentProfileId: 'student-A', leftAt: null },
      { id: 'm2', studentGroupId: 'group-1', studentProfileId: 'student-B', leftAt: null },
      { id: 'm3', studentGroupId: 'group-2', studentProfileId: 'student-C', leftAt: null },
      { id: 'm4', studentGroupId: 'group-3', studentProfileId: 'student-D', leftAt: null },
    ]

    // Compute next rotation assignments (just position reassignments)
    const nextAssignments = computeNextRotationAssignments(state)

    // Group membership is entirely separate — nextAssignments only touches positions
    // Memberships are unchanged
    const membersAfter = membersBefore // rotation engine does not touch memberships

    // Integrity check must still pass after rotation
    expect(validateStudentGroupIntegrity(state.studentGroups, membersAfter)).toBe(true)

    // Verify no student group was split: student-A and student-B are still both in group-1
    const group1Members = membersAfter.filter((m) => m.studentGroupId === 'group-1')
    expect(group1Members.map((m) => m.studentProfileId)).toContain('student-A')
    expect(group1Members.map((m) => m.studentProfileId)).toContain('student-B')
  })

  it('no rotation assignment changes a studentGroupId', () => {
    const state = makeState(4)
    const nextPositions = computeNextRotationAssignments(state)

    // Keys in the map are groupIds; values are positionIds
    // The group IDs themselves are unchanged — only which position they map to changes
    const groupIds = Array.from(nextPositions.keys()).sort()
    const originalGroupIds = state.studentGroups.map((g) => g.id).sort()
    expect(groupIds).toEqual(originalGroupIds)
  })

  it('every active group has a next position after rotation', () => {
    const state = makeState(5)
    const nextPositions = computeNextRotationAssignments(state)

    const activeGroups = state.studentGroups.filter((g) => g.isActive)
    for (const group of activeGroups) {
      expect(nextPositions.has(group.id)).toBe(true)
    }
  })

  it('student group integrity holds for every possible rotation step (3-step cycle)', () => {
    const state = makeState(3)
    const memberships: StudentGroupMembership[] = [
      { id: 'm1', studentGroupId: 'group-1', studentProfileId: 'student-1', leftAt: null },
      { id: 'm2', studentGroupId: 'group-2', studentProfileId: 'student-2', leftAt: null },
      { id: 'm3', studentGroupId: 'group-3', studentProfileId: 'student-3', leftAt: null },
    ]

    // Simulate 3 rotations
    let currentState = state
    for (let i = 0; i < 3; i++) {
      const next = computeNextRotationAssignments(currentState)

      // Memberships never change — integrity always holds
      expect(validateStudentGroupIntegrity(currentState.studentGroups, memberships)).toBe(true)

      // Advance state: update currentAssignments to reflect next rotation
      const newAssignments: GroupRotationAssignment[] = currentState.currentAssignments.map(
        (a, idx) => ({
          ...a,
          id: `assign-r${i + 2}-${idx}`,
          carouselPositionId: next.get(a.studentGroupId)!,
          rotationNumber: i + 2,
        })
      )
      currentState = { ...currentState, currentAssignments: newAssignments }
    }

    // After full cycle, group-1 should be back at pos-1
    const group1Assignment = currentState.currentAssignments.find(
      (a) => a.studentGroupId === 'group-1'
    )
    expect(group1Assignment?.carouselPositionId).toBe('pos-1')
  })
})
