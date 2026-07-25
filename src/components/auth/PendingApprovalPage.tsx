"use client";

import * as React from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Clock, Mail, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function PendingApprovalPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isChecking, setIsChecking] = React.useState(false);

  const user = session?.user as
    | { name?: string; email?: string }
    | undefined;

  const handleCheckStatus = async () => {
    setIsChecking(true);
    try {
      // Re-fetch the session to see if status changed
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (data?.user?.status === "ACTIVE") {
        router.push("/");
        router.refresh();
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 px-8 text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-6">
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>

          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Pending approval
          </h1>

          {user?.name && (
            <p className="text-gray-700 font-medium mb-1">{user.name}</p>
          )}

          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Your account request is under review. An administrator will approve
            your access shortly. You will receive an email notification at{" "}
            {user?.email ? (
              <strong className="text-gray-700">{user.email}</strong>
            ) : (
              "your registered address"
            )}{" "}
            once approved.
          </p>

          {/* Steps */}
          <div className="space-y-2 mb-8 text-left">
            {[
              { icon: Mail, text: "Account request received" },
              { icon: Clock, text: "Awaiting administrator review" },
              { icon: RefreshCw, text: "Approval email sent when ready" },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-3">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    i === 0
                      ? "bg-green-100 text-green-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {i === 0 ? (
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                </div>
                <span
                  className={`text-sm ${
                    i === 0
                      ? "text-green-700 font-medium"
                      : i === 1
                      ? "text-gray-700"
                      : "text-gray-400"
                  }`}
                >
                  {text}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Button
              onClick={handleCheckStatus}
              variant="outline"
              className="w-full"
              disabled={isChecking}
              loading={isChecking}
            >
              <RefreshCw className="h-4 w-4" />
              {isChecking ? "Checking..." : "Check approval status"}
            </Button>
            <Button
              onClick={handleSignOut}
              variant="ghost"
              className="w-full text-gray-500"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>

          <p className="mt-6 text-xs text-gray-400">
            Questions?{" "}
            <Link
              href="mailto:pe@micds.org"
              className="text-primary-900 hover:underline"
            >
              Contact the PE department
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
