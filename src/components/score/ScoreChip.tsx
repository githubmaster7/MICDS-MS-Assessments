import * as React from "react";
import { cn, scoreToLevel, type ScoreLevel } from "@/lib/utils";
import { SCORE_LABELS } from "@/lib/constants";

interface ScoreChipProps {
  score: number;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const levelStyles: Record<ScoreLevel, string> = {
  red: "bg-red-100 text-red-700 border border-red-200",
  yellow: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  lightgreen: "bg-green-100 text-green-700 border border-green-200",
  brightgreen: "bg-green-500 text-white border border-green-600",
};

const sizeStyles = {
  sm: "px-1.5 py-0.5 text-xs rounded",
  md: "px-2.5 py-1 text-sm rounded-md",
  lg: "px-3 py-1.5 text-base rounded-md",
};

export function ScoreChip({
  score,
  showLabel = false,
  size = "md",
  className,
}: ScoreChipProps) {
  const level = scoreToLevel(score);
  const label = SCORE_LABELS[score as keyof typeof SCORE_LABELS] ?? `${score}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold tabular-nums",
        levelStyles[level],
        sizeStyles[size],
        className
      )}
      title={label}
    >
      <span>{score}</span>
      {showLabel && (
        <span className="font-normal opacity-80">{label}</span>
      )}
    </span>
  );
}
