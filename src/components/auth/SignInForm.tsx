"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { z } from "zod";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

const signInSchema = z.object({
  email: z
    .string()
    .email("Enter a valid email address")
    .endsWith("@micds.org", "Must be a @micds.org email address"),
  password: z.string().min(1, "Password is required"),
});

// Short, library/middleware-level error codes (never shown as-is - mapped to
// a friendly message). Anything else reaching resolveErrorMessage() is
// assumed to be one of the full human-readable sentences authorize() throws
// in src/lib/auth.ts (e.g. "Your account is pending administrator
// approval."), which next-auth passes through verbatim as the error value -
// those are already safe and correct to show directly.
const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Incorrect email or password. Please try again.",
  AccountDisabled: "Your account has been disabled. Contact your administrator.",
  default: "Something went wrong. Please try again.",
};

function resolveErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code in ERROR_MESSAGES) return ERROR_MESSAGES[code];
  return code;
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // "/" does server-side role-based redirection (admin/teacher/student/parent
  // dashboards), so it's the correct landing spot when no explicit
  // callbackUrl was carried over from a protected-route redirect.
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [serverError, setServerError] = React.useState<string | null>(
    resolveErrorMessage(errorParam)
  );
  const [isLoading, setIsLoading] = React.useState(false);

  const validate = () => {
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        const field = e.path[0] as string;
        fieldErrors[field] = e.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setServerError(resolveErrorMessage(result.error));
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setServerError(ERROR_MESSAGES.default);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">Sign in</h1>
        <p className="mt-1 text-sm text-gray-500">
          Use your MICDS email address
        </p>
      </div>

      {serverError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@micds.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            disabled={isLoading}
          />
          {errors.email && (
            <p id="email-error" className="text-xs text-red-600 mt-1">
              {errors.email}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-primary-900 hover:text-primary-900 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              disabled={isLoading}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-sm"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="text-xs text-red-600 mt-1">
              {errors.password}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
          loading={isLoading}
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        No account yet?{" "}
        <Link
          href="/auth/signup"
          className="text-primary-900 font-medium hover:underline"
        >
          Request access
        </Link>
      </p>
    </div>
  );
}
