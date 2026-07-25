import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary-600 text-role-fg",
        secondary:
          "border-transparent bg-secondary-100 text-secondary-700",
        destructive:
          "border-transparent bg-danger-100 text-danger-700 border-danger-200",
        outline:
          "border-gray-300 text-gray-700 bg-white",
        success:
          "border-transparent bg-success-100 text-success-700 border-success-200",
        warning:
          "border-transparent bg-warning-100 text-warning-800 border-warning-200",
        // Score level variants
        "score-1":
          "border-score-incomplete-border bg-score-incomplete-bg text-score-incomplete-text",
        "score-2":
          "border-score-developing-border bg-score-developing-bg text-score-developing-text",
        "score-3":
          "border-score-achieving-border bg-score-achieving-bg text-score-achieving-text",
        "score-4":
          "border-score-exceeding-border bg-score-exceeding-bg text-score-exceeding-text",
        // Role variants
        admin:
          "border-purple-200 bg-purple-100 text-purple-700",
        teacher:
          "border-amber-200 bg-amber-100 text-amber-700",
        student:
          "border-teal-200 bg-teal-100 text-teal-700",
        parent:
          "border-secondary-200 bg-secondary-100 text-secondary-700",
        // Status variants
        pending:
          "border-warning-200 bg-warning-100 text-warning-800",
        approved:
          "border-success-200 bg-success-100 text-success-700",
        rejected:
          "border-danger-200 bg-danger-100 text-danger-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
