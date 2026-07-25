"use client";

import { LayoutDashboard } from "lucide-react";
import { RoleAppShell, type RoleNavItem } from "@/components/layout/RoleAppShell";

const NAV_ITEMS: RoleNavItem[] = [
  { label: "Dashboard", href: "/parent/dashboard", icon: LayoutDashboard, exact: true },
];

/**
 * Client-side wrapper so icon components never cross the server/client
 * boundary — ParentLayout is a server component (getServerSession) and can
 * only pass serializable props like strings down to this component.
 */
export function ParentAppShell({
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
      role="parent"
      panelLabel="Parent Panel"
      navItems={NAV_ITEMS}
      userName={userName}
      userEmail={userEmail}
      footerNote="Read-only access"
    >
      {children}
    </RoleAppShell>
  );
}
