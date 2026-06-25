import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}

export function Spinner({ size = "md", className, label = "Loading..." }: SpinnerProps) {
  const sizeClass = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-10 w-10 border-[3px]",
  }[size];

  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-block", className)}
    >
      <span
        className={cn(
          "block animate-spin rounded-full border-gray-200 border-t-primary-600",
          sizeClass
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function FullPageSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div
      className="flex h-full min-h-[400px] w-full items-center justify-center"
      role="status"
      aria-label={label}
    >
      <Spinner size="lg" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
