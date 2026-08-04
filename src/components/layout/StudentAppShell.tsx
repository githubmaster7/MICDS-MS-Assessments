"use client";

import { LayoutDashboard, BookOpen } from "lucide-react";
import { RoleAppShell, type RoleNavItem } from "@/components/layout/RoleAppShell";

const NAV_ITEMS: RoleNavItem[] = [
  { label: "My Dashboard", href: "/student/dashboard", icon: LayoutDashboard, exact: true },
  { label: "My Classes", href: "/student/history", icon: BookOpen },
];

/**
 * Client-side wrapper so icon components never cross the server/client
 * boundary — StudentLayout is a server component (getServerSession) and can
 * only pass serializable props like strings down to this component.
 */
export function StudentAppShell({
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
      role="student"
      panelLabel="Student Panel"
      navItems={NAV_ITEMS}
      userName={userName}
      userEmail={userEmail}
    >
      {children}
    </RoleAppShell>
  );
}
