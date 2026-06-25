import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "MICDS PE Assessment",
    template: "%s | MICDS PE Assessment",
  },
};

/**
 * Auth layout: centers content on a slate-50 background with a top accent
 * stripe. The individual page/component is responsible for its own card and
 * branding since both SignInForm and SignUpForm ship their own headers.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="h-1 bg-gradient-to-r from-primary-700 via-primary-500 to-primary-400" />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        {children}
      </div>
    </div>
  );
}
