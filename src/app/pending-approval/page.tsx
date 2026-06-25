import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Awaiting Approval | MICDS PE Assessment",
};

export default async function PendingApprovalPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if ((session.user as { status?: string }).status === "ACTIVE") redirect("/");

  const user = session.user as {
    name?: string | null;
    email?: string | null;
    role?: string;
    status?: string;
  };

  const ROLE_LABELS: Record<string, string> = {
    TEACHER: "Teacher",
    STUDENT: "Student",
    PARENT: "Parent",
    ADMIN: "Admin",
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-100 mb-6">
          <svg
            className="h-8 w-8 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          Awaiting approval
        </h1>

        {user.name && (
          <p className="text-sm font-medium text-gray-700 mb-1">{user.name}</p>
        )}

        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Your account request is under review. An administrator will approve
          your access shortly. You will receive an email notification at{" "}
          {user.email ? (
            <strong className="text-gray-700">{user.email}</strong>
          ) : (
            "your registered address"
          )}{" "}
          once approved.
        </p>

        {/* Status steps */}
        <div className="space-y-2 mb-8 text-left">
          {[
            { label: "Account request received", done: true },
            { label: "Awaiting administrator review", done: false, active: true },
            { label: "Approval email sent when ready", done: false },
          ].map(({ label, done, active }) => (
            <div key={label} className="flex items-center gap-3">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  done
                    ? "bg-green-100 text-green-600"
                    : active
                    ? "bg-amber-100 text-amber-600"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : active ? (
                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="8" />
                  </svg>
                )}
              </div>
              <span
                className={`text-sm ${
                  done
                    ? "text-green-700 font-medium"
                    : active
                    ? "text-gray-800 font-medium"
                    : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Details */}
        {(user.email || user.role) && (
          <div className="bg-gray-50 rounded-lg p-3 text-left mb-6 space-y-1">
            {user.email && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Email</span>
                <span className="text-gray-800 font-medium">{user.email}</span>
              </div>
            )}
            {user.role && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Role requested</span>
                <span className="text-gray-800 font-medium">{ROLE_LABELS[user.role] ?? user.role}</span>
              </div>
            )}
          </div>
        )}

        <Link
          href="/api/auth/signout"
          className="text-sm text-gray-400 hover:text-gray-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        >
          Sign out
        </Link>

        <p className="mt-4 text-xs text-gray-400">
          Questions?{" "}
          <Link href="mailto:pe@micds.org" className="text-primary-600 hover:underline">
            Contact the PE department
          </Link>
        </p>
      </div>
    </div>
  );
}
