"use client";

import * as React from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  UserCog,
  UserX,
  UserCheck,
  Users,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { ROLES } from "@/lib/constants";
import { PageHeader } from "@/components/layout/PageHeader";

interface User {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  studentProfile?: { firstName: string; lastName: string } | null;
  teacherProfile?: { firstName: string; lastName: string } | null;
  parentProfile?: { firstName: string; lastName: string } | null;
}

function displayName(user: User): string {
  const profile = user.studentProfile ?? user.teacherProfile ?? user.parentProfile;
  return profile ? `${profile.firstName} ${profile.lastName}` : user.email;
}

const PAGE_SIZE = 25;

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-700 border-green-100",
  PENDING_EMAIL_VERIFICATION: "bg-yellow-50 text-yellow-700 border-yellow-100",
  PENDING_ADMIN_APPROVAL: "bg-yellow-50 text-yellow-700 border-yellow-100",
  DEACTIVATED: "bg-red-50 text-red-600 border-red-100",
  REJECTED: "bg-gray-100 text-gray-500 border-gray-200",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  PENDING_EMAIL_VERIFICATION: "Pending Verification",
  PENDING_ADMIN_APPROVAL: "Pending Approval",
  DEACTIVATED: "Deactivated",
  REJECTED: "Rejected",
};

function formatDate(iso?: string) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function UsersPage() {
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("ALL");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [page, setPage] = React.useState(1);
  const [users, setUsers] = React.useState<User[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  const [editTarget, setEditTarget] = React.useState<User | null>(null);
  const [editRole, setEditRole] = React.useState("");
  const [editLoading, setEditLoading] = React.useState(false);

  const [deactivateTarget, setDeactivateTarget] = React.useState<User | null>(null);
  const [deactivateLoading, setDeactivateLoading] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, statusFilter]);

  const fetchUsers = React.useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (roleFilter !== "ALL") params.set("role", roleFilter);
    if (statusFilter !== "ALL") params.set("status", statusFilter);

    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setUsers(d?.data ?? []);
        setTotal(d?.pagination?.total ?? 0);
      })
      .catch(() => { setUsers([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, roleFilter, statusFilter]);

  React.useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleEditRole = async () => {
    if (!editTarget || !editRole) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: editRole }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Role updated", description: `${displayName(editTarget)} is now a ${ROLE_LABELS[editRole]}.` });
      setEditTarget(null);
      fetchUsers();
    } catch {
      toast({ title: "Failed to update role", variant: "destructive" });
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    const isActive = deactivateTarget.status === "ACTIVE";
    setDeactivateLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${deactivateTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isActive ? "DEACTIVATED" : "ACTIVE" }),
      });
      if (!res.ok) throw new Error();
      toast({ title: isActive ? "User deactivated" : "User reactivated" });
      setDeactivateTarget(null);
      fetchUsers();
    } catch {
      toast({ title: "Action failed", variant: "destructive" });
    } finally {
      setDeactivateLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader title="Users" description="Manage all MICDS PE Assessment accounts." />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
          <Input
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
            aria-label="Search users"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-32 h-8 text-sm" aria-label="Filter by role">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            <SelectItem value={ROLES.ADMIN}>Admin</SelectItem>
            <SelectItem value={ROLES.TEACHER}>Teacher</SelectItem>
            <SelectItem value={ROLES.STUDENT}>Student</SelectItem>
            <SelectItem value={ROLES.PARENT}>Parent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-sm" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PENDING_EMAIL_VERIFICATION">Pending Verification</SelectItem>
            <SelectItem value="PENDING_ADMIN_APPROVAL">Pending Approval</SelectItem>
            <SelectItem value="DEACTIVATED">Deactivated</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        {(debouncedSearch || roleFilter !== "ALL" || statusFilter !== "ALL") && (
          <button
            onClick={() => { setSearch(""); setRoleFilter("ALL"); setStatusFilter("ALL"); }}
            className="text-xs text-primary-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400 tabular-nums">{total.toLocaleString()} user{total !== 1 ? "s" : ""}</span>
      </div>

      <div className="bg-white rounded-xl border border-primary-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[650px]">
            <thead>
              <tr className="border-b border-gray-100 bg-primary-50">
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide sr-only">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full max-w-[100px]" /></td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No users found.</p>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900">{displayName(user)}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{ROLE_LABELS[user.role] ?? user.role}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[user.status] ?? "bg-gray-50 text-gray-600 border-gray-200"}`}>
                        {STATUS_LABELS[user.status] ?? user.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${displayName(user)}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditTarget(user); setEditRole(user.role); }}>
                            <UserCog className="h-4 w-4 mr-2" />
                            Edit role
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className={user.status === "ACTIVE" ? "text-red-600 focus:text-red-600 focus:bg-red-50" : "text-green-700 focus:text-green-700 focus:bg-green-50"}
                            onClick={() => setDeactivateTarget(user)}
                          >
                            {user.status === "ACTIVE" ? (
                              <><UserX className="h-4 w-4 mr-2" />Deactivate</>
                            ) : (
                              <><UserCheck className="h-4 w-4 mr-2" />Reactivate</>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
            <span>{Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 tabular-nums">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit role modal */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit role</DialogTitle></DialogHeader>
          {editTarget && (
            <div className="space-y-4 py-2">
              <div className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
                <p className="font-medium text-gray-900">{displayName(editTarget)}</p>
                <p className="text-gray-500">{editTarget.email}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-role">New role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger id="user-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ROLES.ADMIN}>Admin</SelectItem>
                    <SelectItem value={ROLES.TEACHER}>Teacher</SelectItem>
                    <SelectItem value={ROLES.STUDENT}>Student</SelectItem>
                    <SelectItem value={ROLES.PARENT}>Parent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)} disabled={editLoading}>Cancel</Button>
            <Button onClick={handleEditRole} disabled={!editRole || editRole === editTarget?.role} loading={editLoading}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate confirm */}
      <Dialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
              {deactivateTarget?.status === "ACTIVE" ? "Deactivate user" : "Reactivate user"}
            </DialogTitle>
          </DialogHeader>
          {deactivateTarget && (
            <p className="text-sm text-gray-600 py-2">
              {deactivateTarget.status === "ACTIVE" ? (
                <><strong>{displayName(deactivateTarget)}</strong> will no longer be able to sign in. You can reactivate their account at any time.</>
              ) : (
                <><strong>{displayName(deactivateTarget)}</strong>&apos;s account will be restored to active status.</>
              )}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)} disabled={deactivateLoading}>Cancel</Button>
            <Button
              variant={deactivateTarget?.status === "ACTIVE" ? "destructive" : "success"}
              onClick={handleDeactivate}
              loading={deactivateLoading}
            >
              {deactivateTarget?.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
