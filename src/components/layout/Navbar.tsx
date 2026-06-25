"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LogOut, User, Settings, Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ROLES } from "@/lib/constants";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case ROLES.ADMIN:
      return "admin" as const;
    case ROLES.TEACHER:
      return "teacher" as const;
    case ROLES.STUDENT:
      return "student" as const;
    case ROLES.PARENT:
      return "parent" as const;
    default:
      return "secondary" as const;
  }
}

export function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();

  const user = session?.user as
    | { name?: string; email?: string; image?: string; role?: string }
    | undefined;

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/auth/signin");
  };

  return (
    <header className="sticky top-0 z-40 h-14 w-full border-b border-gray-200 bg-white">
      <div className="flex h-full items-center px-4 gap-4">
        {/* Mobile brand */}
        <Link
          href="/dashboard"
          className="md:hidden font-semibold text-sm text-gray-900 tracking-tight"
        >
          MICDS PE
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Notification bell placeholder */}
          <button
            className="relative rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>

          {/* User menu */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-md p-1 hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  aria-label="User menu"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={user.image ?? ""} alt={user.name ?? ""} />
                    <AvatarFallback className="text-xs">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[140px] truncate">
                    {user.name}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-gray-900">
                      {user.name}
                    </span>
                    <span className="font-normal text-gray-500 text-xs">
                      {user.email}
                    </span>
                    {user.role && (
                      <Badge
                        variant={getRoleBadgeVariant(user.role)}
                        className="w-fit mt-0.5"
                      >
                        {user.role}
                      </Badge>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                {user.role === ROLES.ADMIN && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/settings" className="cursor-pointer">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
