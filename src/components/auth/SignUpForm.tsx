"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLES } from "@/lib/constants";

const signUpSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(80),
    email: z
      .string()
      .email("Enter a valid email address")
      .endsWith("@micds.org", "Must be a @micds.org email address"),
    role: z.enum(
      [ROLES.TEACHER, ROLES.STUDENT, ROLES.PARENT],
      { required_error: "Select your role" }
    ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[0-9]/, "Must contain at least one number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignUpData = z.infer<typeof signUpSchema>;

export function SignUpForm() {
  const router = useRouter();

  const [formData, setFormData] = React.useState<Partial<SignUpData>>({});
  const [showPassword, setShowPassword] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  const setField = (field: keyof SignUpData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const result = signUpSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => {
        const field = e.path[0] as string;
        if (!fieldErrors[field]) fieldErrors[field] = e.message;
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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email?.trim().toLowerCase(),
          requestedRole: formData.role,
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data.error ?? "Registration failed. Please try again.");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/pending-approval"), 2000);
    } catch {
      setServerError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-sm mx-auto text-center py-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
          <CheckCircle2 className="h-6 w-6 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Request submitted
        </h2>
        <p className="text-sm text-gray-500">
          Your account request has been submitted. An administrator will review
          it shortly. You will receive an email at{" "}
          <strong>{formData.email}</strong> once approved.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 mb-4">
          <span className="text-primary-700 font-bold text-lg">PE</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Request access</h1>
        <p className="mt-1 text-sm text-gray-500">
          Accounts require administrator approval
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
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Jane Smith"
            value={formData.name ?? ""}
            onChange={(e) => setField("name", e.target.value)}
            error={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            disabled={isLoading}
          />
          {errors.name && (
            <p id="name-error" className="text-xs text-red-600">
              {errors.name}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            placeholder="you@micds.org"
            value={formData.email ?? ""}
            onChange={(e) => setField("email", e.target.value)}
            error={!!errors.email}
            aria-describedby={errors.email ? "signup-email-error" : undefined}
            disabled={isLoading}
          />
          {errors.email && (
            <p id="signup-email-error" className="text-xs text-red-600">
              {errors.email}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="role">Role</Label>
          <Select
            value={formData.role}
            onValueChange={(v) => setField("role", v)}
            disabled={isLoading}
          >
            <SelectTrigger
              id="role"
              aria-describedby={errors.role ? "role-error" : undefined}
            >
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROLES.TEACHER}>Teacher</SelectItem>
              <SelectItem value={ROLES.STUDENT}>Student</SelectItem>
              <SelectItem value={ROLES.PARENT}>Parent / Guardian</SelectItem>
            </SelectContent>
          </Select>
          {errors.role && (
            <p id="role-error" className="text-xs text-red-600">
              {errors.role}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-password">Password</Label>
          <div className="relative">
            <Input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Min. 8 chars, 1 uppercase, 1 number"
              value={formData.password ?? ""}
              onChange={(e) => setField("password", e.target.value)}
              error={!!errors.password}
              aria-describedby={
                errors.password ? "signup-password-error" : undefined
              }
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
            <p id="signup-password-error" className="text-xs text-red-600">
              {errors.password}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={formData.confirmPassword ?? ""}
            onChange={(e) => setField("confirmPassword", e.target.value)}
            error={!!errors.confirmPassword}
            aria-describedby={
              errors.confirmPassword ? "confirm-password-error" : undefined
            }
            disabled={isLoading}
          />
          {errors.confirmPassword && (
            <p id="confirm-password-error" className="text-xs text-red-600">
              {errors.confirmPassword}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
          loading={isLoading}
        >
          {isLoading ? "Submitting..." : "Request access"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-primary-600 font-medium hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
