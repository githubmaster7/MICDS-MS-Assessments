import type { Metadata } from "next";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/SignInForm";

export const metadata: Metadata = { title: "Sign In | MICDS PE Assessment" };

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="h-1 bg-gradient-to-r from-primary-700 via-primary-500 to-primary-400" />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="mb-8 text-center">
          <Image
            src="/images/micds-pe-logo.png"
            alt="MICDS Physical Education"
            width={690}
            height={338}
            priority
            className="h-20 w-auto mx-auto mb-4"
          />
          <p className="text-xs font-semibold tracking-widest text-primary-900 uppercase mb-1">
            MICDS Middle School
          </p>
          <p className="text-sm text-gray-500">Physical Education Assessment System</p>
        </div>
        <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 shadow-sm px-8 py-8">
          <Suspense>
            <SignInForm />
          </Suspense>
        </div>
        <p className="mt-6 text-xs text-gray-400">
          Mary Institute and Saint Louis Country Day School
        </p>
      </div>
    </div>
  );
}
