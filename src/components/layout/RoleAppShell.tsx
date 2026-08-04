"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { ChevronLeft, ChevronRight, LogOut, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RoleNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  /** Match only the exact path (for dashboard roots) instead of a prefix match. */
  exact?: boolean;
}

export type Role = "admin" | "teacher" | "student" | "parent";

interface SidebarContentProps {
  panelLabel: string;
  navItems: RoleNavItem[];
  userName?: string;
  userEmail?: string;
  footerNote?: string;
  collapsed: boolean;
  onCollapse?: (v: boolean) => void;
}

function SidebarContent({
  panelLabel,
  navItems,
  userName,
  userEmail,
  footerNote,
  collapsed,
  onCollapse,
}: SidebarContentProps) {
  const pathname = usePathname();

  return (
    <>
      <div className="flex h-14 items-center border-b border-role-fg/10 px-3 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* White chip behind the logo — the ram's own maroon/gray artwork
                needs a light backdrop to stay legible against any of the 4
                role colors the sidebar itself renders in. */}
            <span className="shrink-0 bg-white rounded-md p-1 flex items-center">
              <Image
                src="/images/micds-pe-logo.png"
                alt="MICDS Physical Education"
                width={690}
                height={338}
                className="h-6 w-auto"
              />
            </span>
            <span className="font-semibold text-sm text-role-fg truncate">
              {panelLabel}
            </span>
          </div>
        )}
        {onCollapse && (
          <button
            onClick={() => onCollapse(!collapsed)}
            className={cn(
              "ml-auto rounded-md p-1.5 text-role-fg/60 hover:bg-role-fg/10 hover:text-role-fg transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-role-fg/50",
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
        )}
      </div>

      <nav
        className="flex-1 overflow-y-auto py-3 px-2"
        aria-label={`${panelLabel} navigation`}
      >
        <ul className="space-y-0.5" role="list">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-role-fg/50",
                    isActive
                      ? "bg-white text-primary-900 font-medium shadow-sm"
                      : "text-role-fg/75 hover:bg-role-fg/10 hover:text-role-fg"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive ? "text-primary-900" : "text-role-fg/60"
                    )}
                    aria-hidden="true"
                  />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge != null && item.badge > 0 && (
                        <span className="inline-flex items-center justify-center rounded-full bg-white text-primary-900 text-[10px] font-semibold min-w-[18px] h-[18px] px-1 tabular-nums">
                          {item.badge > 99 ? "99+" : item.badge}
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

      <div className="border-t border-role-fg/10 px-2 py-3 shrink-0">
        {!collapsed ? (
          <div className="px-2 py-1.5">
            {footerNote && (
              <p className="text-[10px] text-role-fg/60 mb-2">{footerNote}</p>
            )}
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                <span className="text-primary-900 text-xs font-semibold">
                  {userName?.charAt(0)?.toUpperCase() ?? "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-role-fg truncate">
                  {userName ?? "User"}
                </p>
                <p className="text-[10px] text-role-fg/60 truncate">
                  {userEmail ?? ""}
                </p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-role-fg/60 hover:text-role-fg p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-role-fg/50"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center justify-center p-2 text-role-fg/60 hover:text-role-fg rounded-md hover:bg-role-fg/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-role-fg/50"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </>
  );
}

/**
 * Shared app shell for every role area (Admin/Teacher/Student/Parent) — one
 * consistent layout, themed per role via the `role` prop. `data-role` on the
 * root element re-anchors the CSS-variable-backed `primary` Tailwind scale
 * (see globals.css) to that role's single brand hue, so the header banner,
 * sidebar, default buttons, focus rings, and table/panel accents everywhere
 * in `{children}` all resolve to the same color without per-usage changes.
 * Each role's layout.tsx keeps its own server-side auth/redirect check and
 * just supplies its role, nav items, and user info.
 */
export function RoleAppShell({
  role,
  panelLabel,
  navItems,
  userName,
  userEmail,
  footerNote,
  children,
}: {
  role: Role;
  panelLabel: string;
  navItems: RoleNavItem[];
  userName?: string;
  userEmail?: string;
  footerNote?: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-white" data-role={role}>
      <aside
        className={cn(
          "hidden md:flex flex-col h-full bg-primary-700 transition-all duration-200 shrink-0",
          collapsed ? "w-[60px]" : "w-56"
        )}
      >
        <SidebarContent
          panelLabel={panelLabel}
          navItems={navItems}
          userName={userName}
          userEmail={userEmail}
          footerNote={footerNote}
          collapsed={collapsed}
          onCollapse={setCollapsed}
        />
      </aside>

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
          <div className="absolute left-0 top-0 h-full w-56 bg-primary-700 shadow-xl z-50 flex flex-col">
            <SidebarContent
              panelLabel={panelLabel}
              navItems={navItems}
              userName={userName}
              userEmail={userEmail}
              footerNote={footerNote}
              collapsed={false}
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <header className="md:hidden flex h-14 items-center border-b border-role-fg/10 bg-primary-700 px-4 gap-3 shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-role-fg/70 hover:text-role-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-role-fg/50 rounded"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="shrink-0 bg-white rounded-md p-1 flex items-center">
              <Image
                src="/images/micds-pe-logo.png"
                alt="MICDS Physical Education"
                width={690}
                height={338}
                className="h-5 w-auto"
              />
            </span>
            <span className="font-semibold text-sm text-role-fg">
              {panelLabel}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
