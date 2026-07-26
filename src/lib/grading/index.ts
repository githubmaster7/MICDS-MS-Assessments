/**
 * Grading module — re-exports all grading functions and types.
 */

export type { StandardScoreItem, StandardScoreResult } from './standard-score'
export { calculateStandardScore } from './standard-score'

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
