import { PageHeader } from "@/components/layout/PageHeader";
import { ScoringRubricCard } from "@/components/shared/ScoringRubricCard";
import { SCORING_RUBRIC } from "@/lib/grading/rubric";

export default function AdminScoringCalculationsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Scoring Calculations"
        description="How each standard's 1-4 score is calculated, shown to students alongside their self-rating."
      />

      <div className="space-y-5">
        {([1, 2, 3, 4] as const).map((n) => (
          <ScoringRubricCard key={n} rubric={SCORING_RUBRIC[n]} />
        ))}
      </div>
    </div>
  );
}
