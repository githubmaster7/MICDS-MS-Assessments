"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import { LogOut, GraduationCap, Users2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";

const COMING_SOON_SECTIONS = [
  {
    icon: GraduationCap,
    title: "Student grade history",
    description:
      "Every student's past grades across each class they've taken, for any school year — not just the current one.",
  },
  {
    icon: Users2,
    title: "Group history",
    description:
      "Which student groups each student has belonged to over time, and when they joined or left.",
  },
  {
    icon: BookOpen,
    title: "Teacher class history",
    description:
      "Which classes each teacher has taught, which groups, and over what time periods.",
  },
];

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="School Settings" description="Account and historical data." />

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-900">Account</h2>
        <p className="text-sm text-gray-500 mt-1 mb-4">Sign out of the admin panel on this device.</p>
        <Button
          variant="outline"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>

      <div className="space-y-3">
        {COMING_SOON_SECTIONS.map((section) => (
          <div
            key={section.title}
            className="bg-white border border-dashed border-gray-300 rounded-lg p-5 opacity-70"
          >
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <section.icon className="h-4.5 w-4.5 text-gray-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-900">{section.title}</h2>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">
                    Coming soon
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{section.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
