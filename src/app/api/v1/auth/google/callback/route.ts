import { NextResponse } from "next/server";
import { config } from "@/server/config";
import { ApiError } from "@/server/http/errors";
import { route } from "@/server/http/handler";
import { readOAuth } from "@/server/oauth/state";
import { exchangeGoogleCode, linkGoogleToSession, loginOrCreateWithGoogle } from "@/server/services/google-auth";

export const GET = route.public(async ({ req }) => {
  const url = new URL(req.url);
  const err = url.searchParams.get("error");
  try {
    const meta = await readOAuth("google", url.searchParams.get("state"));
    if (err) return NextResponse.redirect(new URL(`/login?oauth=denied`, config.appUrl));
    const code = url.searchParams.get("code");
    if (!code) return NextResponse.redirect(new URL(`/login?oauth=denied`, config.appUrl));
    const profile = await exchangeGoogleCode(code, `${config.appUrl}/api/v1/auth/google/callback`);
    if (meta.intent === "link") await linkGoogleToSession(profile);
    else await loginOrCreateWithGoogle(profile);
    return NextResponse.redirect(new URL(meta.next, config.appUrl));
  } catch (e) {
    const message = e instanceof ApiError ? e.message : "Google sign-in failed";
    return NextResponse.redirect(new URL(`/login?oauth=error&reason=${encodeURIComponent(message)}`, config.appUrl));
  }
});
