"use client";

import * as React from "react";
import Link from "next/link";
import {
  UserCheck,
  Users,
  Group,
  RotateCcw,
  ArrowRight,
  TrendingUp,
  Clock,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Stats {
  pendingSignups: number;
  activeUsers: number;
  studentGroups: number;
  activeRotations: number;
}

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  targetLabel?: string;
  createdAt: string;
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
  accentClass,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  href: string;
  accentClass: string;
  loading: boolean;
}) {
  return (
    <Link
      href={href}
      className="group bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 hover:border-primary-300 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <div
        className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${accentClass}`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          {label}
        </p>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-3xl font-semibold text-gray-900 tabular-nums">
            {value.toLocaleString()}
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary-500 transition-colors mt-1 shrink-0" />
    </Link>
  );
}

function actionBadgeVariant(
  action: string
): "default" | "secondary" | "destructive" {
  const up = action.toUpperCase();
  if (
    up.includes("APPROVED") ||
    up.includes("CREATED") ||
    up.includes("ADDED")
  )
    return "default";
  if (
    up.includes("REJECTED") ||
    up.includes("DELETED") ||
    up.includes("DEACTIVATED")
  )
    return "destructive";
  return "secondary";
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [auditLogs, setAuditLogs] = React.useState<AuditEntry[]>([]);
  const [statsLoading, setStatsLoading] = React.useState(true);
  const [logsLoading, setLogsLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      fetch("/api/admin/signup-requests?status=PENDING&limit=1").then((r) =>
        r.json()
      ),
      fetch("/api/admin/users?limit=1").then((r) => r.json()),
      fetch("/api/admin/student-groups?limit=1").then((r) => r.json()),
    ])
      .then(([signups, users, groups]) => {
        setStats({
          pendingSignups: signups?.total ?? 0,
          activeUsers: users?.total ?? 0,
          studentGroups: groups?.total ?? 0,
          activeRotations: 0,
        });
      })
      .catch(() =>
        setStats({
          pendingSignups: 0,
          activeUsers: 0,
          studentGroups: 0,
          activeRotations: 0,
        })
      )
      .finally(() => setStatsLoading(false));

    fetch("/api/admin/audit-logs?limit=8")
      .then((r) => r.json())
      .then((d) => setAuditLogs(d?.logs ?? []))
      .catch(() => setAuditLogs([]))
      .finally(() => setLogsLoading(false));
  }, []);

  const statCards = [
    {
      label: "Pending Signups",
      value: stats?.pendingSignups ?? 0,
      icon: UserCheck,
      href: "/admin/signup-requests",
      accentClass: "bg-amber-50 text-amber-600",
    },
    {
      label: "Active Users",
      value: stats?.activeUsers ?? 0,
      icon: Users,
      href: "/admin/users",
      accentClass: "bg-blue-50 text-blue-600",
    },
    {
      label: "Student Groups",
      value: stats?.studentGroups ?? 0,
      icon: Group,
      href: "/admin/groups",
      accentClass: "bg-violet-50 text-violet-600",
    },
    {
      label: "Active Rotations",
      value: stats?.activeRotations ?? 0,
      icon: RotateCcw,
      href: "/admin/carousel",
      accentClass: "bg-green-50 text-green-600",
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Overview of the MICDS PE Assessment system
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} loading={statsLoading} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Audit log */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-gray-900">
                Recent Activity
              </h2>
            </div>
            <Link
              href="/admin/audit-logs"
              className="text-xs text-primary-600 hover:underline font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              View all
            </Link>
          </div>

          {logsLoading ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-12 text-center">
              <TrendingUp className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No activity yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {auditLogs.map((entry) => (
                <div
                  key={entry.id}
                  className="px-5 py-3 flex items-center gap-3 text-sm hover:bg-gray-50 transition-colors"
                >
                  <span className="text-gray-400 shrink-0 tabular-nums text-xs w-16">
                    {formatRelative(entry.createdAt)}
                  </span>
                  <Badge
                    variant={actionBadgeVariant(entry.action)}
                    className="text-[10px] shrink-0"
                  >
                    {entry.action.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-gray-700 truncate">
                    <span className="font-medium">{entry.actor}</span>
                    {entry.targetLabel ? ` → ${entry.targetLabel}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">
              Quick Actions
            </h2>
          </div>
          <div className="p-4 space-y-2">
            <Button asChild className="w-full justify-between" size="sm">
              <Link href="/admin/signup-requests">
                Approve Pending
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-between"
              size="sm"
            >
              <Link href="/admin/carousel">
                Rotate Classes
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full justify-between"
              size="sm"
            >
              <Link href="/admin/users?role=STUDENT">
                View All Students
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="w-full justify-between"
              size="sm"
            >
              <Link href="/admin/audit-logs">
                Audit Logs
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
