/**
 * Grading module — re-exports all grading functions and types.
 */

export type { SkillScore, Standard1Result } from './standard1'
export { calculateStandard1 } from './standard1'

export type { ItemScore, StandardResult } from './standards234'
export { calculateStandard234 } from './standards234'

export type { OverallGradeInput, OverallGradeResult } from './conversion'
export {
  STANDARD_SCORE_MAP,
  standardScoreToInternal,
  internalAverageToLetterGrade,
  calculateLetterGrade,
  calculateOverallGrade,
} from './conversion'

export type { ATLInput, ATLResult } from './approach-to-learning'
export { calculateDaysLateScore, calculateApproachToLearning } from './approach-to-learning'

export { countWordChanges, isRevised } from './resubmission'
