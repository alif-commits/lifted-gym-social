import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic routing only: it checks for the *presence* of the session cookie to avoid flashing the wrong
 * page. Real authentication and authorisation always happen server-side in the API and the (app) layout.
 */
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-lifted_session" : "lifted_session";
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(COOKIE);
  if (hasSession && (pathname === "/" || AUTH_PAGES.includes(pathname))) {
    return NextResponse.redirect(new URL("/feed", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/register", "/forgot-password"],
};
