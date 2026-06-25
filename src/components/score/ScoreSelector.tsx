"use client";

import * as React from "react";
import { cn, scoreToLevel, type ScoreLevel } from "@/lib/utils";
import { VALID_SCORES, SCORE_LABELS, type ValidScore } from "@/lib/constants";

interface ScoreSelectorProps {
  value?: number | null;
  onChange: (score: ValidScore) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

const levelStyles: Record<ScoreLevel, { base: string; selected: string }> = {
  red: {
    base: "border-red-200 hover:bg-red-50 hover:border-red-400 text-red-700",
    selected: "bg-red-500 border-red-500 text-white shadow-sm",
  },
  yellow: {
    base: "border-yellow-200 hover:bg-yellow-50 hover:border-yellow-400 text-yellow-800",
    selected: "bg-yellow-500 border-yellow-500 text-white shadow-sm",
  },
  lightgreen: {
    base: "border-green-200 hover:bg-green-50 hover:border-green-400 text-green-700",
    selected: "bg-green-300 border-green-400 text-green-900 shadow-sm",
  },
  brightgreen: {
    base: "border-green-300 hover:bg-green-50 hover:border-green-500 text-green-700",
    selected: "bg-green-500 border-green-600 text-white shadow-sm",
  },
};

export function ScoreSelector({
  value,
  onChange,
  disabled = false,
  label,
  className,
}: ScoreSelectorProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </p>
      )}
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label={label ?? "Score selector"}
      >
        {VALID_SCORES.map((score) => {
          const level = scoreToLevel(score);
          const isSelected = value === score;
          const styles = levelStyles[level];
          const scoreLabel = SCORE_LABELS[score];

          return (
            <button
              key={score}
              type="button"
              onClick={() => !disabled && onChange(score)}
              disabled={disabled}
              aria-pressed={isSelected}
              title={scoreLabel}
              className={cn(
                "flex flex-col items-center justify-center rounded-md border px-2.5 py-2 text-xs font-semibold transition-all min-w-[48px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1",
                "disabled:cursor-not-allowed disabled:opacity-50",
                isSelected ? styles.selected : cn("bg-white", styles.base)
              )}
            >
              <span className="text-sm tabular-nums">{score}</span>
              <span
                className={cn(
                  "text-[10px] mt-0.5 leading-tight text-center",
                  isSelected ? "opacity-90" : "opacity-60"
                )}
              >
                {scoreLabel.replace("Beginning", "Beg").replace("Developing", "Dev").replace("Proficient", "Prof").replace("Advanced", "Adv")}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
