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

export const APP_NAME = "MICDS PE Assessment";
export const SCHOOL_NAME = "Mary Institute and Saint Louis Country Day School";
export const SCHOOL_SHORT = "MICDS";
export const ALLOWED_EMAIL_DOMAIN = "micds.org";

export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,
} as const;

export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds
