"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

type Status = "loading" | "success" | "error" | "missing";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = React.useState<Status>(token ? "loading" : "missing");
  const [errorMessage, setErrorMessage] = React.useState("");

  React.useEffect(() => {
    if (!token) return;
    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
        } else {
          setErrorMessage(data.message ?? "This link is invalid or has expired.");
          setStatus("error");
        }
      } catch {
        setErrorMessage("Network error. Please try again.");
        setStatus("error");
      }
    };
    verify();
  }, [token]);

  const Card = ({ children }: { children: React.ReactNode }) => (
    <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 shadow-sm px-8 py-8 text-center">
      {children}
    </div>
  );

  if (status === "loading") {
    return (
      <Card>
        <Loader2 className="h-10 w-10 animate-spin text-primary-500 mx-auto mb-4" />
        <p className="text-sm text-gray-500">Verifying your email address…</p>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-5">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Email verified</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Your email address has been confirmed. An administrator will review your account shortly.
        </p>
        <Button asChild className="w-full">
          <Link href="/pending-approval">View account status</Link>
        </Button>
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-100 mb-5">
          <XCircle className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Verification failed</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">{errorMessage}</p>
        <div className="space-y-2">
          <Button asChild variant="outline" className="w-full">
            <Link href="/auth/signup">Request a new link</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-yellow-100 mb-5">
        <XCircle className="h-7 w-7 text-yellow-600" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">No verification token</h2>
      <p className="text-sm text-gray-500 mb-6">
        This page requires a verification link from your email. Please check your inbox and click the link provided.
      </p>
      <Button asChild variant="outline" className="w-full">
        <Link href="/login">Back to sign in</Link>
      </Button>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 shadow-sm px-8 py-8 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
