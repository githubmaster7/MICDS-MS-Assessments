/**
 * Carousel rotation engine.
 *
 * Operates on plain data objects that mirror the Prisma schema — no DB calls
 * happen here.  Persistence (transaction, audit log) is the caller's
 * responsibility.
 *
 * Terminology:
 *   CarouselPlan     – a named set of positions for a school year
 *   CarouselPosition – one slot in the plan, tied to a TeacherClassAssignment
 *   StudentGroup     – a cohort of students that rotates together (never splits)
 *   GroupRotationAssignment – the pairing of a group with a position for one
 *                             rotation cycle
 *
 * Rotation model:
 *   Every group occupies exactly one position.  On each rotation, every group
 *   advances to the *next* position (by positionOrder), wrapping around.
 *   Position order is 1-based and contiguous within a plan.
 */

// ---------------------------------------------------------------------------
// Shared types (light-weight mirrors of the Prisma models)
// ---------------------------------------------------------------------------

export interface CarouselPlan {
  id: string
  schoolYearId: string
  name: string
  isActive: boolean
}

export interface CarouselPosition {
  id: string
  carouselPlanId: string
  positionOrder: number
  teacherClassAssignmentId: string
}

export interface GroupRotationAssignment {
  id: string
  studentGroupId: string
  carouselPositionId: string
  rotationNumber: number
  status: string
}

export interface StudentGroup {
  id: string
  name: string
  schoolYearId: string
  gradeLevel: string
  gender: string
  isActive: boolean
}

export interface StudentGroupMembership {
  id: string
  studentGroupId: string
  studentProfileId: string
  /** null means the student is still active in the group */
  leftAt: Date | null
}

// ---------------------------------------------------------------------------
// Engine-specific types
// ---------------------------------------------------------------------------

export interface CarouselState {
  plan: CarouselPlan
  /** Positions ordered by positionOrder ascending */
  positions: CarouselPosition[]
  /** Current active assignments — one per group */
  currentAssignments: GroupRotationAssignment[]
  studentGroups: StudentGroup[]
}

/** positionId → array of groupIds assigned there */
export type AssignmentMap = Map<string, string[]>

/** groupId → new positionId */
export type NewAssignmentMap = Map<string, string>

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface RotationPreview {
  currentState: AssignmentMap
  nextState: AssignmentMap
  affectedGroups: string[]
  affectedTeachers: string[]
  warnings: string[]
  isValid: boolean
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build a map from positionId → array of groupIds */
function buildAssignmentMap(assignments: GroupRotationAssignment[]): AssignmentMap {
  const map: AssignmentMap = new Map()
  for (const a of assignments) {
    const existing = map.get(a.carouselPositionId) ?? []
    existing.push(a.studentGroupId)
    map.set(a.carouselPositionId, existing)
  }
  return map
}

/**
 * Given a sorted (by positionOrder) positions array, return the next position
 * for a group currently at `currentPositionId`, wrapping around.
 */
function nextPosition(
  positions: CarouselPosition[],
  currentPositionId: string
): CarouselPosition {
  const sorted = [...positions].sort((a, b) => a.positionOrder - b.positionOrder)
  const idx = sorted.findIndex((p) => p.id === currentPositionId)
  if (idx === -1) {
    throw new Error(`nextPosition: positionId "${currentPositionId}" not found in plan`)
  }
  const nextIdx = (idx + 1) % sorted.length
  return sorted[nextIdx]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate the current carousel state:
 *   - Every active group has exactly one assignment
 *   - No position hosts more than one group (each position is exclusive)
 *   - All referenced position IDs belong to the plan
 *   - Positions have contiguous, unique ordering
 */
export function validateCarouselRotation(state: CarouselState): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const planPositionIds = new Set(state.positions.map((p) => p.id))
  const activeGroups = state.studentGroups.filter((g) => g.isActive)
  const assignmentsByGroup = new Map<string, GroupRotationAssignment[]>()
  const assignmentsByPosition = new Map<string, GroupRotationAssignment[]>()

  for (const a of state.currentAssignments) {
    // Check position belongs to this plan
    if (!planPositionIds.has(a.carouselPositionId)) {
      errors.push(
        `Assignment for group "${a.studentGroupId}" references position "${a.carouselPositionId}" which is not in plan "${state.plan.id}"`
      )
    }

    const byGroup = assignmentsByGroup.get(a.studentGroupId) ?? []
    byGroup.push(a)
    assignmentsByGroup.set(a.studentGroupId, byGroup)

    const byPos = assignmentsByPosition.get(a.carouselPositionId) ?? []
    byPos.push(a)
    assignmentsByPosition.set(a.carouselPositionId, byPos)
  }

  // Each active group must have exactly one assignment
  for (const group of activeGroups) {
    const assignments = assignmentsByGroup.get(group.id) ?? []
    if (assignments.length === 0) {
      errors.push(`Active group "${group.name}" (${group.id}) has no rotation assignment`)
    } else if (assignments.length > 1) {
      errors.push(
        `Active group "${group.name}" (${group.id}) has ${assignments.length} assignments — expected exactly 1`
      )
    }
  }

  // No position should host more than one group
  for (const [positionId, assignments] of assignmentsByPosition.entries()) {
    if (assignments.length > 1) {
      errors.push(
        `Position "${positionId}" has ${assignments.length} groups assigned — each position must have at most one group`
      )
    }
  }

  // Positions must have unique, contiguous ordering starting at 1
  const orders = state.positions.map((p) => p.positionOrder).sort((a, b) => a - b)
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      errors.push(
        `Position ordering is not contiguous. Expected order ${i + 1}, found ${orders[i]}`
      )
      break
    }
  }

  // Warn about positions with no current group assigned
  for (const position of state.positions) {
    if (!assignmentsByPosition.has(position.id)) {
      warnings.push(
        `Position "${position.id}" (order ${position.positionOrder}) has no group currently assigned`
      )
    }
  }

  return { isValid: errors.length === 0, errors, warnings }
}

/**
 * Calculate what the next rotation would look like WITHOUT executing it.
 * Returns the current state as an AssignmentMap, the proposed next state,
 * affected groups/teachers, warnings, and overall validity.
 */
export function previewNextRotation(state: CarouselState): RotationPreview {
  const validation = validateCarouselRotation(state)
  const warnings = [...validation.warnings]

  if (!validation.isValid) {
    return {
      currentState: buildAssignmentMap(state.currentAssignments),
      nextState: new Map(),
      affectedGroups: [],
      affectedTeachers: [],
      warnings: [...validation.errors, ...warnings],
      isValid: false,
    }
  }

  const currentState = buildAssignmentMap(state.currentAssignments)

  // positionId → teacherClassAssignmentId lookup
  const positionToTeacher = new Map<string, string>(
    state.positions.map((p) => [p.id, p.teacherClassAssignmentId])
  )

  const nextState: AssignmentMap = new Map()
  const affectedGroupIds = new Set<string>()
  const affectedTeacherIds = new Set<string>()

  for (const assignment of state.currentAssignments) {
    const next = nextPosition(state.positions, assignment.carouselPositionId)
    const existing = nextState.get(next.id) ?? []
    existing.push(assignment.studentGroupId)
    nextState.set(next.id, existing)

    // A group is "affected" if its teacher changes
    if (next.id !== assignment.carouselPositionId) {
      affectedGroupIds.add(assignment.studentGroupId)
      const currentTeacher = positionToTeacher.get(assignment.carouselPositionId)
      const nextTeacher = positionToTeacher.get(next.id)
      if (currentTeacher) affectedTeacherIds.add(currentTeacher)
      if (nextTeacher) affectedTeacherIds.add(nextTeacher)
    }
  }

  // Sanity: no collisions in next state
  for (const [positionId, groups] of nextState.entries()) {
    if (groups.length > 1) {
      warnings.push(
        `After rotation, position "${positionId}" would have ${groups.length} groups — check for duplicates`
      )
    }
  }

  return {
    currentState,
    nextState,
    affectedGroups: Array.from(affectedGroupIds),
    affectedTeachers: Array.from(affectedTeacherIds),
    warnings,
    isValid: warnings.filter((w) => w.includes('would have')).length === 0,
  }
}

/**
 * Compute the new groupId → positionId assignments for the next rotation.
 * Returns a NewAssignmentMap that the caller should persist inside a
 * database transaction together with an audit log entry.
 *
 * Throws if the current state fails validation.
 */
export function computeNextRotationAssignments(state: CarouselState): NewAssignmentMap {
  const validation = validateCarouselRotation(state)
  if (!validation.isValid) {
    throw new Error(
      `computeNextRotationAssignments: current carousel state is invalid:\n` +
        validation.errors.join('\n')
    )
  }

  const result: NewAssignmentMap = new Map()

  for (const assignment of state.currentAssignments) {
    const next = nextPosition(state.positions, assignment.carouselPositionId)
    result.set(assignment.studentGroupId, next.id)
  }

  return result
}

/**
 * Validate that no student appears in more than one *active* group (groups
 * must never split).  Members with a non-null leftAt are treated as inactive.
 *
 * Returns true if integrity holds; false otherwise.
 */
export function validateStudentGroupIntegrity(
  groups: StudentGroup[],
  memberships: StudentGroupMembership[]
): boolean {
  const activeGroupIds = new Set(groups.filter((g) => g.isActive).map((g) => g.id))

  // Only consider active memberships (leftAt is null) in active groups
  const activeMemberships = memberships.filter(
    (m) => m.leftAt === null && activeGroupIds.has(m.studentGroupId)
  )

  // Track which groups each student appears in
  const studentToGroups = new Map<string, Set<string>>()
  for (const m of activeMemberships) {
    const existing = studentToGroups.get(m.studentProfileId) ?? new Set()
    existing.add(m.studentGroupId)
    studentToGroups.set(m.studentProfileId, existing)
  }

  for (const [studentProfileId, groupIds] of studentToGroups.entries()) {
    if (groupIds.size > 1) {
      console.error(
        `validateStudentGroupIntegrity: student "${studentProfileId}" belongs to ` +
          `${groupIds.size} active groups: ${Array.from(groupIds).join(', ')}`
      )
      return false
    }
  }

  return true
}
