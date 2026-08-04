import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = [
  "/login",
  "/auth/signup",
  "/auth/verify-email",
  "/pending-approval",
  "/unauthorized",
  "/api/auth",
];

// Each role's page routes and API routes share the same role-gating rule, so
// a single path list covers both - e.g. "/admin" also matches "/api/admin/*".
// Every route under these API prefixes already re-checks its own role
// requirement independently (this was verified route-by-route), so this is
// purely a defense-in-depth backstop: it means a future route that forgets
// its own check is still not reachable by the wrong role, rather than being
// wide open until someone notices.
const ADMIN_PATHS = ["/admin", "/api/admin"];
const TEACHER_PATHS = ["/teacher", "/api/teacher"];
const STUDENT_PATHS = ["/student", "/api/student"];
const PARENT_PATHS = ["/parent", "/api/parent"];

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

  const isApiPath = pathname.startsWith("/api/");

  // API callers expect a JSON response, not an HTML redirect - a fetch()
  // that got redirected to a login/error page would otherwise silently
  // receive that page's HTML back as if it were the API response.
  function denied(status: number, message: string, redirectTo: string) {
    if (isApiPath) {
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Not authenticated — redirect to login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return denied(401, "Unauthorized.", loginUrl.pathname + loginUrl.search);
  }

  const role = token.role as string | undefined;
  const status = token.status as string | undefined;

  // Users who haven't verified their email or been approved by an admin may
  // only see the pending-approval page. No sensitive route is reachable.
  if (
    (status === "PENDING_EMAIL_VERIFICATION" || status === "PENDING_ADMIN_APPROVAL") &&
    pathname !== "/pending-approval"
  ) {
    return denied(403, "Your account is not yet active.", "/pending-approval");
  }

  // REJECTED/DEACTIVATED users are bounced to login
  if (status === "REJECTED" || status === "DEACTIVATED") {
    return denied(403, "Your account has been disabled.", "/login?error=AccountDisabled");
  }

  // Role-based route protection
  if (isAdminPath(pathname) && role !== "ADMIN") {
    return denied(403, "Forbidden.", "/unauthorized");
  }

  if (isTeacherPath(pathname) && role !== "TEACHER" && role !== "ADMIN") {
    return denied(403, "Forbidden.", "/unauthorized");
  }

  if (isStudentPath(pathname) && role !== "STUDENT" && role !== "ADMIN") {
    return denied(403, "Forbidden.", "/unauthorized");
  }

  if (isParentPath(pathname) && role !== "PARENT" && role !== "ADMIN") {
    return denied(403, "Forbidden.", "/unauthorized");
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
