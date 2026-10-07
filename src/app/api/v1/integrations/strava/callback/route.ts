import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { config } from "@/server/config";
import { route } from "@/server/http/handler";
import { readOAuth } from "@/server/oauth/state";
import { exchangeStravaCode, saveStravaConnection, syncStrava } from "@/server/services/strava";

export const GET = route.public(async ({ req }) => {
  const url = new URL(req.url);
  try {
    await readOAuth("strava", url.searchParams.get("state"));
    if (url.searchParams.get("error")) return NextResponse.redirect(new URL("/settings?tab=connections&strava=denied", config.appUrl));
    const code = url.searchParams.get("code");
    const session = await getSession();
    if (!code || !session) return NextResponse.redirect(new URL("/settings?tab=connections&strava=denied", config.appUrl));
    const tokens = await exchangeStravaCode(code);
    await saveStravaConnection(session.user, tokens);
    await syncStrava(session.user, { backfill: true }).catch(() => undefined);
    return NextResponse.redirect(new URL("/settings?tab=connections&strava=connected", config.appUrl));
  } catch {
    return NextResponse.redirect(new URL("/settings?tab=connections&strava=error", config.appUrl));
  }
});
