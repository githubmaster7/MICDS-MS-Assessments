"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart2,
  Settings,
  ClipboardList,
  GraduationCap,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLES } from "@/lib/constants";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: [ROLES.ADMIN, ROLES.TEACHER, ROLES.STUDENT, ROLES.PARENT],
  },
  {
    label: "Students",
    href: "/teacher/students",
    icon: GraduationCap,
    roles: [ROLES.ADMIN, ROLES.TEACHER],
  },
  {
    label: "Rotations",
    href: "/teacher/rotations",
    icon: Calendar,
    roles: [ROLES.ADMIN, ROLES.TEACHER],
  },
  {
    label: "Assessments",
    href: "/teacher/assessments",
    icon: ClipboardList,
    roles: [ROLES.ADMIN, ROLES.TEACHER],
  },
  {
    label: "Reports",
    href: "/teacher/reports",
    icon: BarChart2,
    roles: [ROLES.ADMIN, ROLES.TEACHER],
  },
  {
    label: "My Grades",
    href: "/student/grades",
    icon: BookOpen,
    roles: [ROLES.STUDENT],
  },
  {
    label: "My Progress",
    href: "/student/progress",
    icon: BarChart2,
    roles: [ROLES.STUDENT],
  },
  {
    label: "User Management",
    href: "/admin/users",
    icon: Users,
    roles: [ROLES.ADMIN],
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    roles: [ROLES.ADMIN],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = React.useState(false);

  const role = (session?.user as { role?: string })?.role ?? "";

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(role)
  );

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-full bg-white border-r border-gray-200 transition-all duration-200",
        collapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo area */}
      <div className="flex h-14 items-center border-b border-gray-100 px-3">
        {!collapsed && (
          <span className="font-semibold text-sm text-gray-900 tracking-tight">
            MICDS PE
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "ml-auto rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                    isActive
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-primary-600" : "text-gray-400"
                    )}
                    aria-hidden="true"
                  />
                  {!collapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
