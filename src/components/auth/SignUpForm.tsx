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

interface StudentOption {
  id: string;
  firstName: string;
  lastName: string;
  gradeLevel: string;
  studentId: string;
}

const GRADE_LABELS: Record<string, string> = { GRADE_5: "5", GRADE_6: "6", GRADE_7: "7", GRADE_8: "8" };

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

  const [childSearch, setChildSearch] = React.useState("");
  const [childResults, setChildResults] = React.useState<StudentOption[]>([]);
  const [childSearchLoading, setChildSearchLoading] = React.useState(false);
  const [selectedChildren, setSelectedChildren] = React.useState<StudentOption[]>([]);
  const [childrenError, setChildrenError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (formData.role !== ROLES.PARENT || childSearch.trim().length < 2) {
      setChildResults([]);
      return;
    }
    const t = setTimeout(() => {
      setChildSearchLoading(true);
      fetch(`/api/auth/signup/students?search=${encodeURIComponent(childSearch.trim())}`)
        .then((r) => r.json())
        .then((d) => setChildResults(d?.data ?? []))
        .catch(() => setChildResults([]))
        .finally(() => setChildSearchLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [formData.role, childSearch]);

  const addChild = (student: StudentOption) => {
    setSelectedChildren((prev) => (prev.some((c) => c.id === student.id) ? prev : [...prev, student]));
    setChildrenError(null);
  };

  const removeChild = (id: string) => {
    setSelectedChildren((prev) => prev.filter((c) => c.id !== id));
  };

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
    if (formData.role === ROLES.PARENT && selectedChildren.length === 0) {
      setChildrenError("Select at least one child.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email?.trim().toLowerCase(),
          requestedRole: formData.role,
          password: formData.password,
          studentProfileIds:
            formData.role === ROLES.PARENT ? selectedChildren.map((c) => c.id) : undefined,
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

        {formData.role === ROLES.PARENT && (
          <div className="space-y-1.5">
            <Label htmlFor="child-search">Your child(ren)</Label>
            <p className="text-xs text-gray-500 -mt-1 mb-1.5">
              Search for your child by name or student ID. An administrator will confirm this before your account is approved.
            </p>
            <Input
              id="child-search"
              type="text"
              placeholder="Search by name or student ID…"
              value={childSearch}
              onChange={(e) => setChildSearch(e.target.value)}
              disabled={isLoading}
            />
            {childSearch.trim().length >= 2 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                {childSearchLoading ? (
                  <div className="p-3 text-center text-xs text-gray-400">Searching…</div>
                ) : childResults.length === 0 ? (
                  <div className="p-3 text-center text-xs text-gray-400">No students match.</div>
                ) : (
                  childResults.map((s) => {
                    const alreadyAdded = selectedChildren.some((c) => c.id === s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => addChild(s)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <span>
                          <span className="font-medium text-gray-900">{s.firstName} {s.lastName}</span>
                          <span className="text-gray-400 ml-1.5">
                            Grade {GRADE_LABELS[s.gradeLevel] ?? s.gradeLevel} · {s.studentId}
                          </span>
                        </span>
                        <span className="text-xs text-primary-600 font-medium shrink-0">
                          {alreadyAdded ? "Added" : "Add"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
            {selectedChildren.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selectedChildren.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 pl-2.5 pr-1.5 py-1 text-xs text-gray-700"
                  >
                    {c.firstName} {c.lastName}
                    <button
                      type="button"
                      onClick={() => removeChild(c.id)}
                      className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                      aria-label={`Remove ${c.firstName} ${c.lastName}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {childrenError && (
              <p className="text-xs text-red-600">{childrenError}</p>
            )}
          </div>
        )}

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
