import * as React from "react";
import { cn, scoreToLevel, type ScoreLevel } from "@/lib/utils";
import { SCORE_LABELS } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreChip } from "./ScoreChip";

interface StandardScoreCardProps {
  standardName: string;
  standardCode?: string;
  score?: number | null;
  description?: string;
  teacherNote?: string;
  className?: string;
}

const levelBorderClass: Record<ScoreLevel, string> = {
  red: "border-l-red-400",
  yellow: "border-l-yellow-400",
  lightgreen: "border-l-green-300",
  brightgreen: "border-l-green-500",
};

export function StandardScoreCard({
  standardName,
  standardCode,
  score,
  description,
  teacherNote,
  className,
}: StandardScoreCardProps) {
  const level = score != null ? scoreToLevel(score) : null;
  const label =
    score != null
      ? SCORE_LABELS[score as keyof typeof SCORE_LABELS]
      : undefined;

  return (
    <Card
      className={cn(
        "border-l-4 transition-shadow hover:shadow-md",
        level ? levelBorderClass[level] : "border-l-gray-200",
        className
      )}
    >
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {standardCode && (
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0">
                  {standardCode}
                </span>
              )}
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {standardName}
              </h3>
            </div>
            {description && (
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {description}
              </p>
            )}
            {teacherNote && (
              <div className="mt-2 rounded-md bg-blue-50 border border-blue-100 px-2.5 py-1.5">
                <p className="text-xs text-blue-700">
                  <span className="font-medium">Note: </span>
                  {teacherNote}
                </p>
              </div>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            {score != null ? (
              <>
                <ScoreChip score={score} size="lg" />
                {label && (
                  <span className="text-xs text-gray-500">{label}</span>
                )}
              </>
            ) : (
              <span className="text-sm text-gray-400 italic">Not yet scored</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
