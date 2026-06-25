import * as React from "react";
import { cn } from "@/lib/utils";

interface ColorDistribution {
  red: number;
  yellow: number;
  lightgreen: number;
  brightgreen: number;
}

interface ColorDistributionBarProps {
  distribution: ColorDistribution;
  showLabels?: boolean;
  showCounts?: boolean;
  height?: "sm" | "md" | "lg";
  className?: string;
}

const segmentConfig = [
  {
    key: "red" as const,
    label: "Beginning",
    color: "bg-red-400",
    textColor: "text-red-700",
    bgLight: "bg-red-50",
  },
  {
    key: "yellow" as const,
    label: "Developing",
    color: "bg-yellow-400",
    textColor: "text-yellow-700",
    bgLight: "bg-yellow-50",
  },
  {
    key: "lightgreen" as const,
    label: "Proficient",
    color: "bg-green-300",
    textColor: "text-green-700",
    bgLight: "bg-green-50",
  },
  {
    key: "brightgreen" as const,
    label: "Advanced",
    color: "bg-green-500",
    textColor: "text-green-800",
    bgLight: "bg-green-100",
  },
];

const heightClass = {
  sm: "h-2",
  md: "h-3",
  lg: "h-4",
};

export function ColorDistributionBar({
  distribution,
  showLabels = false,
  showCounts = false,
  height = "md",
  className,
}: ColorDistributionBarProps) {
  const total =
    distribution.red +
    distribution.yellow +
    distribution.lightgreen +
    distribution.brightgreen;

  const getPercent = (count: number): number =>
    total === 0 ? 0 : (count / total) * 100;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Bar */}
      <div
        className={cn(
          "flex w-full overflow-hidden rounded-full bg-gray-100",
          heightClass[height]
        )}
        role="img"
        aria-label="Score color distribution"
      >
        {segmentConfig.map(({ key, label, color }) => {
          const pct = getPercent(distribution[key]);
          if (pct === 0) return null;
          return (
            <div
              key={key}
              className={cn("transition-all", color)}
              style={{ width: `${pct}%` }}
              title={`${label}: ${distribution[key]} (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>

      {/* Legend */}
      {(showLabels || showCounts) && (
        <div className="flex flex-wrap gap-3">
          {segmentConfig.map(({ key, label, color, textColor, bgLight }) => {
            const count = distribution[key];
            const pct = getPercent(count);
            if (count === 0 && !showLabels) return null;

            return (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-1.5 rounded px-2 py-0.5",
                  bgLight
                )}
              >
                <span
                  className={cn("h-2.5 w-2.5 rounded-full", color)}
                  aria-hidden="true"
                />
                <span className={cn("text-xs font-medium", textColor)}>
                  {showLabels && label}
                  {showLabels && showCounts && ": "}
                  {showCounts && (
                    <span className="tabular-nums">
                      {count} ({pct.toFixed(0)}%)
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
