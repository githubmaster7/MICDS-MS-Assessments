"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  UserCheck,
  Users,
  Group,
  GraduationCap,
  RotateCcw,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badgeKey?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  {
    label: "Signup Requests",
    href: "/admin/signup-requests",
    icon: UserCheck,
    badgeKey: "signupRequests",
  },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Student Groups", href: "/admin/groups", icon: Group },
  {
    label: "Teachers & Classes",
    href: "/admin/teachers",
    icon: GraduationCap,
  },
  {
    label: "Carousel & Rotations",
    href: "/admin/carousel",
    icon: RotateCcw,
  },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
  { label: "School Settings", href: "/admin/settings", icon: Settings },
];

function NavSidebar({
  collapsed,
  onCollapse,
  pendingCount,
}: {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  pendingCount: number;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as { name?: string; email?: string } | undefined;

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-full bg-white border-r border-gray-200 transition-all duration-200 shrink-0",
        collapsed ? "w-[60px]" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-gray-100 px-3 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="h-7 w-7 rounded-md bg-primary-700 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">PE</span>
            </div>
            <span className="font-semibold text-sm text-gray-900 truncate">
              Admin Panel
            </span>
          </div>
        )}
        <button
          onClick={() => onCollapse(!collapsed)}
          className={cn(
            "ml-auto rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
            collapsed && "mx-auto"
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

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto py-3 px-2"
        aria-label="Admin navigation"
      >
        <ul className="space-y-0.5" role="list">
          {NAV_ITEMS.map((item) => {
            // Exact match for dashboard root, prefix match for others
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const badge =
              item.badgeKey === "signupRequests" && pendingCount > 0
                ? pendingCount
                : null;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                    isActive
                      ? "bg-primary-50 text-primary-700 font-medium"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-primary-600" : "text-gray-400"
                    )}
                    aria-hidden="true"
                  />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {badge !== null && (
                        <span className="inline-flex items-center justify-center rounded-full bg-primary-600 text-white text-[10px] font-semibold min-w-[18px] h-[18px] px-1 tabular-nums">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 px-2 py-3 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="h-7 w-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
              <span className="text-primary-700 text-xs font-semibold">
                {user?.name?.charAt(0)?.toUpperCase() ?? "A"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">
                {user?.name ?? "Admin"}
              </p>
              <p className="text-[10px] text-gray-400 truncate">
                {user?.email ?? ""}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="text-gray-400 hover:text-gray-600 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="flex w-full items-center justify-center p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(0);

  React.useEffect(() => {
    fetch("/api/admin/signup-requests?status=PENDING&limit=1")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.total === "number") setPendingCount(d.total);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <NavSidebar
        collapsed={collapsed}
        onCollapse={setCollapsed}
        pendingCount={pendingCount}
      />

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          aria-modal="true"
          role="dialog"
          aria-label="Navigation"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-56 bg-white shadow-xl z-50">
            <NavSidebar
              collapsed={false}
              onCollapse={() => setMobileOpen(false)}
              pendingCount={pendingCount}
            />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <header className="md:hidden flex h-14 items-center border-b border-gray-200 bg-white px-4 gap-3 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary-700 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">PE</span>
            </div>
            <span className="font-semibold text-sm text-gray-900">
              Admin Panel
            </span>
          </div>
          {pendingCount > 0 && (
            <Link
              href="/admin/signup-requests"
              className="ml-auto flex items-center gap-1.5 text-xs text-primary-600 font-medium hover:underline"
            >
              <Bell className="h-4 w-4" />
              {pendingCount} pending
            </Link>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
