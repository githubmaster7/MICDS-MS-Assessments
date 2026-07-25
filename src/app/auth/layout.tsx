import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "MICDS PE Assessment",
    template: "%s | MICDS PE Assessment",
  },
};

/**
 * Auth layout: centers content on a white background. The individual
 * page/component is responsible for its own card and branding since both
 * SignInForm and SignUpForm ship their own headers.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  );
}
