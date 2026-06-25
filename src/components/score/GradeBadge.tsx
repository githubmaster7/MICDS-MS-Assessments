import * as React from "react";
import { cn, formatGrade } from "@/lib/utils";

interface GradeBadgeProps {
  percentage: number;
  size?: "sm" | "md" | "lg" | "xl";
  showPercentage?: boolean;
  className?: string;
}

function gradeToStyle(grade: string): string {
  switch (grade) {
    case "A":
    case "A-":
      return "bg-green-100 text-green-800 border-green-300";
    case "B+":
    case "B":
    case "B-":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "C+":
    case "C":
    case "C-":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "D+":
    case "D":
    case "D-":
      return "bg-orange-100 text-orange-800 border-orange-300";
    case "F":
      return "bg-red-100 text-red-800 border-red-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
}

const sizeConfig = {
  sm: { container: "w-8 h-8 text-sm", percentage: "text-xs" },
  md: { container: "w-12 h-12 text-xl", percentage: "text-sm" },
  lg: { container: "w-16 h-16 text-2xl", percentage: "text-sm" },
  xl: { container: "w-20 h-20 text-3xl", percentage: "text-base" },
};

export function GradeBadge({
  percentage,
  size = "md",
  showPercentage = false,
  className,
}: GradeBadgeProps) {
  const grade = formatGrade(percentage);
  const style = gradeToStyle(grade);
  const config = sizeConfig[size];

  return (
    <div className={cn("inline-flex flex-col items-center gap-1", className)}>
      <div
        className={cn(
          "flex items-center justify-center rounded-full border-2 font-bold tabular-nums",
          config.container,
          style
        )}
        aria-label={`Grade ${grade} (${percentage.toFixed(1)}%)`}
      >
        {grade}
      </div>
      {showPercentage && (
        <span className={cn("text-gray-500 tabular-nums", config.percentage)}>
          {percentage.toFixed(1)}%
        </span>
      )}
    </div>
  );
}
