import { NextResponse } from "next/server";
import { config } from "@/server/config";
import { beginOAuth } from "@/server/oauth/state";
import { route } from "@/server/http/handler";
import { badRequest } from "@/server/http/errors";

export const GET = route.public(async ({ req }) => {
  if (!config.google.configured) throw badRequest("Google sign-in is not configured");
  const url = new URL(req.url);
  const intent = url.searchParams.get("intent") === "link" ? "link" : "login";
  const nextRaw = url.searchParams.get("next") ?? (intent === "link" ? "/settings?tab=connections" : "/feed");
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/feed";
  const state = await beginOAuth({ provider: "google", intent, next });
  const redirectUri = `${config.appUrl}/api/v1/auth/google/callback`;
  const dest = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  dest.searchParams.set("client_id", config.google.clientId);
  dest.searchParams.set("redirect_uri", redirectUri);
  dest.searchParams.set("response_type", "code");
  dest.searchParams.set("scope", "openid email profile");
  dest.searchParams.set("state", state);
  dest.searchParams.set("prompt", intent === "link" ? "select_account" : "select_account");
  return NextResponse.redirect(dest);
});
