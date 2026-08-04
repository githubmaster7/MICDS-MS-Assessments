import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata: Metadata = { title: "Request Access" };

export default function SignupPage() {
  return (
    <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 shadow-sm px-8 py-8">
      <SignUpForm />
    </div>
  );
}
