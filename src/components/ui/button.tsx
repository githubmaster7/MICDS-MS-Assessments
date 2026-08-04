import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-primary-600 text-role-fg shadow hover:bg-primary-700 active:bg-primary-800",
        destructive:
          "bg-danger-600 text-white shadow-sm hover:bg-danger-700 active:bg-danger-800",
        outline:
          "border border-gray-300 bg-white shadow-sm hover:bg-gray-50 hover:text-gray-900 text-gray-700",
        secondary:
          "bg-secondary-600 text-white shadow-sm hover:bg-secondary-700 active:bg-secondary-800",
        ghost:
          "text-gray-700 hover:bg-gray-100 hover:text-gray-900",
        link:
          "text-primary-900 underline-offset-4 hover:underline",
        success:
          "bg-success-600 text-white shadow-sm hover:bg-success-700 active:bg-success-800",
        warning:
          "bg-warning-500 text-white shadow-sm hover:bg-warning-600 active:bg-warning-700",
      },
      size: {
        sm: "h-8 rounded-md px-3 text-xs",
        md: "h-9 px-4 py-2",
        lg: "h-11 rounded-md px-8 text-base",
        icon: "h-9 w-9",
        "icon-sm": "h-7 w-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, asChild, children, ...props }, ref) => {
    // asChild merges the button's styling/props onto its single child (e.g. a
    // Next.js <Link>) instead of wrapping it in a real <button> — wrapping
    // would nest one interactive element inside another and break navigation
    // semantics. loading/aria-busy don't apply to an arbitrary child element,
    // so that combination isn't supported.
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{ className?: string }>;
      return React.cloneElement(child, {
        className: cn(buttonVariants({ variant, size, className }), child.props.className),
        ...props,
      });
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
