import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic routing only: it checks for the *presence* of the session cookie to avoid flashing the wrong
 * page. Real authentication and authorisation always happen server-side in the API and the (app) layout.
 */
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-lifted_session" : "lifted_session";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(COOKIE);
  if (!hasSession && pathname.startsWith("/admin") && pathname !== "/admin/login") {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }
  // Login/register are not bounced here: a stale cookie must not loop `/login` ↔ `/feed`.
  if (hasSession && pathname === "/") {
    return NextResponse.redirect(new URL("/feed", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin", "/admin/:path*"],
};
