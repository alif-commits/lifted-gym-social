import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { config } from "@/server/config";
import { unauthenticated } from "@/server/http/errors";
import { route } from "@/server/http/handler";
import { beginOAuth } from "@/server/oauth/state";
import { requireStravaConfigured, stravaRedirectUri } from "@/server/services/strava";

export const GET = route.public(async () => {
  requireStravaConfigured();
  const session = await getSession();
  if (!session) throw unauthenticated();
  const state = await beginOAuth({ provider: "strava", intent: "link", next: "/settings?tab=connections" });
  const dest = new URL("https://www.strava.com/oauth/authorize");
  dest.searchParams.set("client_id", config.strava.clientId);
  dest.searchParams.set("redirect_uri", stravaRedirectUri());
  dest.searchParams.set("response_type", "code");
  dest.searchParams.set("approval_prompt", "auto");
  dest.searchParams.set("scope", "activity:read");
  dest.searchParams.set("state", state);
  return NextResponse.redirect(dest);
});
