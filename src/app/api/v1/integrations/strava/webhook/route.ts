import { NextResponse } from "next/server";
import { config } from "@/server/config";
import { route } from "@/server/http/handler";
import { handleStravaWebhook } from "@/server/services/strava";

export const GET = route.public(async ({ req }) => {
  const url = new URL(req.url);
  const challenge = url.searchParams.get("hub.challenge");
  const verify = url.searchParams.get("hub.verify_token");
  if (config.strava.webhookSecret && verify !== config.strava.webhookSecret) {
    return NextResponse.json({ success: false }, { status: 403 });
  }
  return NextResponse.json({ "hub.challenge": challenge });
});

export const POST = route.public(async ({ req }) => {
  const body = (await req.json().catch(() => ({}))) as { owner_id?: number; object_type?: string; aspect_type?: string; object_id?: number };
  await handleStravaWebhook(body);
  return NextResponse.json({ ok: true });
});
