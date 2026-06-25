export const ALLOWED_ACTIVITIES = [
  "Athletic Development",
  "Ultimate Frisbee",
  "Flag Football",
  "Tennis",
  "Squash",
  "Volleyball",
  "Floor Hockey",
  "Wrestling",
  "Yoga",
] as const;

export type Activity = (typeof ALLOWED_ACTIVITIES)[number];

export const SCORE_COLORS = {
  1: "#ef4444",
  1.5: "#ef4444",
  2: "#eab308",
  2.5: "#eab308",
  3: "#86efac",
  3.5: "#86efac",
  4: "#22c55e",
} as const;

export const SCORE_LABELS = {
  1: "Beginning",
  1.5: "Beginning+",
  2: "Developing",
  2.5: "Developing+",
  3: "Proficient",
  3.5: "Proficient+",
  4: "Advanced",
} as const;

export const GRADE_THRESHOLDS = [
  { min: 93, grade: "A", gpa: 4.0 },
  { min: 90, grade: "A-", gpa: 3.7 },
  { min: 87, grade: "B+", gpa: 3.3 },
  { min: 83, grade: "B", gpa: 3.0 },
  { min: 80, grade: "B-", gpa: 2.7 },
  { min: 77, grade: "C+", gpa: 2.3 },
  { min: 73, grade: "C", gpa: 2.0 },
  { min: 70, grade: "C-", gpa: 1.7 },
  { min: 67, grade: "D+", gpa: 1.3 },
  { min: 63, grade: "D", gpa: 1.0 },
  { min: 60, grade: "D-", gpa: 0.7 },
  { min: 0, grade: "F", gpa: 0.0 },
] as const;

export const STANDARD_SCORE_MAP: Record<number, number> = {
  1: 0.5,
  1.5: 0.6,
  2: 0.7,
  2.5: 0.75,
  3: 0.8,
  3.5: 0.9,
  4: 1.0,
};

export const VALID_SCORES = [1, 1.5, 2, 2.5, 3, 3.5, 4] as const;
export type ValidScore = (typeof VALID_SCORES)[number];

export enum ROLES {
  ADMIN = "ADMIN",
  TEACHER = "TEACHER",
  STUDENT = "STUDENT",
  PARENT = "PARENT",
}

export enum ROTATION_STATUSES {
  UPCOMING = "UPCOMING",
  ACTIVE = "ACTIVE",
  GRADING = "GRADING",
  COMPLETED = "COMPLETED",
  ARCHIVED = "ARCHIVED",
}

export enum USER_STATUSES {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SUSPENDED = "SUSPENDED",
}

export const MAX_DAYS_LATE_THRESHOLDS = {
  NO_PENALTY: 0,
  MINOR_PENALTY: 1,
  MODERATE_PENALTY: 3,
  MAJOR_PENALTY: 7,
  MAX_LATE: 14,
} as const;

export const LATE_PENALTY_RATES = {
  PER_DAY: 0.02,
  MAX_DEDUCTION: 0.1,
} as const;

export const APP_NAME = "MICDS PE Assessment";
export const SCHOOL_NAME = "Mary Institute and Saint Louis Country Day School";
export const SCHOOL_SHORT = "MICDS";
export const ALLOWED_EMAIL_DOMAIN = "micds.org";

export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,
} as const;

export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

export const SCORE_CHIP_CLASSES = {
  red: "bg-red-100 text-red-700 border border-red-200",
  yellow: "bg-yellow-100 text-yellow-700 border border-yellow-200",
  lightgreen: "bg-green-100 text-green-700 border border-green-200",
  brightgreen: "bg-green-500 text-white",
} as const;
