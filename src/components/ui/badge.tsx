import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary-600 text-white",
        secondary:
          "border-transparent bg-gray-100 text-gray-700",
        destructive:
          "border-transparent bg-red-100 text-red-700 border-red-200",
        outline:
          "border-gray-300 text-gray-700 bg-white",
        success:
          "border-transparent bg-green-100 text-green-700 border-green-200",
        warning:
          "border-transparent bg-yellow-100 text-yellow-800 border-yellow-200",
        // Score level variants
        "score-1":
          "border-red-200 bg-red-100 text-red-700",
        "score-2":
          "border-yellow-200 bg-yellow-100 text-yellow-800",
        "score-3":
          "border-green-200 bg-green-100 text-green-700",
        "score-4":
          "border-green-600 bg-green-500 text-white",
        // Role variants
        admin:
          "border-purple-200 bg-purple-100 text-purple-700",
        teacher:
          "border-blue-200 bg-blue-100 text-blue-700",
        student:
          "border-sky-200 bg-sky-100 text-sky-700",
        parent:
          "border-indigo-200 bg-indigo-100 text-indigo-700",
        // Status variants
        pending:
          "border-orange-200 bg-orange-100 text-orange-700",
        approved:
          "border-green-200 bg-green-100 text-green-700",
        rejected:
          "border-red-200 bg-red-100 text-red-700",
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
