"use client";

import { LayoutDashboard, PencilLine, BarChart3, BookOpen, Calculator } from "lucide-react";
import { RoleAppShell, type RoleNavItem } from "@/components/layout/RoleAppShell";

const NAV_ITEMS: RoleNavItem[] = [
  { label: "Dashboard", href: "/teacher/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Grade Students", href: "/teacher/grade/students", icon: PencilLine },
  { label: "Year at a Glance", href: "/teacher/mass-grading", icon: BarChart3 },
  { label: "My History", href: "/teacher/history", icon: BookOpen },
  { label: "Scoring Calculations", href: "/teacher/scoring-calculations", icon: Calculator },
];

/**
 * Client-side wrapper so the icon components (function references) never
 * have to cross the server/client boundary — TeacherLayout is a server
 * component (it calls getServerSession) and can only pass serializable
 * props like strings down to this component.
 */
export function TeacherAppShell({
  userName,
  userEmail,
  children,
}: {
  userName?: string;
  userEmail?: string;
  children: React.ReactNode;
}) {
  return (
    <RoleAppShell
      role="teacher"
      panelLabel="Teacher Panel"
      navItems={NAV_ITEMS}
      userName={userName}
      userEmail={userEmail}
    >
      {children}
    </RoleAppShell>
  );
}
