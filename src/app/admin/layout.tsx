"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  UserCheck,
  Users,
  Group,
  GraduationCap,
  RotateCcw,
  ScrollText,
  Settings,
  ClipboardList,
  Layers,
  UserRound,
} from "lucide-react";
import { RoleAppShell, type RoleNavItem } from "@/components/layout/RoleAppShell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const user = session?.user as { name?: string; email?: string } | undefined;
  const [pendingCount, setPendingCount] = React.useState(0);

  React.useEffect(() => {
    fetch("/api/admin/signup-requests?status=PENDING_ADMIN_APPROVAL&limit=1")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.pagination?.total === "number") setPendingCount(d.pagination.total);
      })
      .catch(() => {});
  }, []);

  const navItems: RoleNavItem[] = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
    {
      label: "Signup Requests",
      href: "/admin/signup-requests",
      icon: UserCheck,
      badge: pendingCount,
    },
    { label: "Users", href: "/admin/users", icon: Users },
    { label: "Student Groups", href: "/admin/groups", icon: Group },
    { label: "All Students", href: "/admin/students", icon: ClipboardList },
    { label: "Parents", href: "/admin/parents", icon: UserRound },
    { label: "Teachers & Classes", href: "/admin/teachers", icon: GraduationCap },
    { label: "Carousel & Rotations", href: "/admin/carousel", icon: RotateCcw },
    { label: "All Classes", href: "/admin/classes", icon: Layers },
    { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
    { label: "School Settings", href: "/admin/settings", icon: Settings },
  ];

  return (
    <RoleAppShell
      role="admin"
      panelLabel="Admin Panel"
      navItems={navItems}
      userName={user?.name}
      userEmail={user?.email}
    >
      {children}
    </RoleAppShell>
  );
}
