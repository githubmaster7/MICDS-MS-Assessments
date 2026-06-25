import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy");
}

export function formatDatetime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return format(d, "MMM d, yyyy h:mm a");
}

export function formatGrade(percentage: number): string {
  if (percentage >= 93) return "A";
  if (percentage >= 90) return "A-";
  if (percentage >= 87) return "B+";
  if (percentage >= 83) return "B";
  if (percentage >= 80) return "B-";
  if (percentage >= 77) return "C+";
  if (percentage >= 73) return "C";
  if (percentage >= 70) return "C-";
  if (percentage >= 67) return "D+";
  if (percentage >= 63) return "D";
  if (percentage >= 60) return "D-";
  return "F";
}

export type ScoreLevel = "red" | "yellow" | "lightgreen" | "brightgreen";

export function scoreToLevel(score: number): ScoreLevel {
  if (score <= 1.5) return "red";
  if (score <= 2.5) return "yellow";
  if (score <= 3.5) return "lightgreen";
  return "brightgreen";
}

export function scoreToColor(score: number): string {
  const level = scoreToLevel(score);
  const map: Record<ScoreLevel, string> = {
    red: "score-chip-red",
    yellow: "score-chip-yellow",
    lightgreen: "score-chip-lightgreen",
    brightgreen: "score-chip-brightgreen",
  };
  return map[level];
}

export function scoreToBgClass(score: number): string {
  const level = scoreToLevel(score);
  const map: Record<ScoreLevel, string> = {
    red: "bg-score-red text-white",
    yellow: "bg-score-yellow text-white",
    lightgreen: "bg-score-lightgreen text-gray-900",
    brightgreen: "bg-score-brightgreen text-white",
  };
  return map[level];
}

export function scoreToHex(score: number): string {
  const level = scoreToLevel(score);
  const map: Record<ScoreLevel, string> = {
    red: "#ef4444",
    yellow: "#eab308",
    lightgreen: "#86efac",
    brightgreen: "#22c55e",
  };
  return map[level];
}

export function isValidMICDSEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  // Must be exactly user@micds.org — no subdomains, no lookalikes
  const pattern = /^[a-z0-9._%+\-]+@micds\.org$/;
  return pattern.test(trimmed);
}

export function standardScoreToPercentage(score: number): number {
  const map: Record<number, number> = {
    1: 0.5,
    1.5: 0.6,
    2: 0.7,
    2.5: 0.75,
    3: 0.8,
    3.5: 0.9,
    4: 1.0,
  };
  return map[score] ?? 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function calculateAverageScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((a, b) => a + b, 0);
  return sum / scores.length;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}
