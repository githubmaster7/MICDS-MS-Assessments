import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = [
  "/auth/signin",
  "/auth/signup",
  "/auth/error",
  "/auth/verify",
  "/pending-approval",
  "/api/auth",
];

const ADMIN_PATHS = ["/admin"];
const TEACHER_PATHS = ["/teacher"];
const STUDENT_PATHS = ["/student"];
const PARENT_PATHS = ["/parent"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function isTeacherPath(pathname: string): boolean {
  return TEACHER_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function isStudentPath(pathname: string): boolean {
  return STUDENT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

function isParentPath(pathname: string): boolean {
  return PARENT_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow Next.js internals and static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|woff2|ttf)$/)
  ) {
    return NextResponse.next();
  }

  // Allow public API routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow public pages
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Not authenticated — redirect to sign in
  if (!token) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  const role = token.role as string | undefined;
  const status = token.status as string | undefined;

  // PENDING users may only see the pending approval page
  if (status === "PENDING" && pathname !== "/pending-approval") {
    return NextResponse.redirect(new URL("/pending-approval", request.url));
  }

  // REJECTED/SUSPENDED users are bounced to sign in
  if (status === "REJECTED" || status === "SUSPENDED") {
    return NextResponse.redirect(
      new URL("/auth/signin?error=AccountDisabled", request.url)
    );
  }

  // Role-based route protection
  if (isAdminPath(pathname) && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  if (isTeacherPath(pathname) && role !== "TEACHER" && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  if (isStudentPath(pathname) && role !== "STUDENT" && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  if (isParentPath(pathname) && role !== "PARENT" && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
