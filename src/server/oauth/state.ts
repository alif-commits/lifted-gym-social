import { cookies } from "next/headers";
import { config } from "@/server/config";
import { randomToken } from "@/server/lib/ids";

const COOKIE = config.isProd ? "__Host-lifted_oauth" : "lifted_oauth";

export type OAuthMeta = { state: string; provider: "google" | "strava"; intent: "login" | "link"; next: string };

export async function beginOAuth(meta: Omit<OAuthMeta, "state">) {
  const state = randomToken(24);
  const value = Buffer.from(JSON.stringify({ ...meta, state })).toString("base64url");
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return state;
}

export async function readOAuth(expectedProvider: OAuthMeta["provider"], state: string | null): Promise<OAuthMeta> {
  const raw = (await cookies()).get(COOKIE)?.value;
  (await cookies()).delete(COOKIE);
  if (!raw || !state) throw new Error("missing");
  const meta = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as OAuthMeta;
  if (meta.state !== state || meta.provider !== expectedProvider) throw new Error("mismatch");
  if (!meta.next.startsWith("/") || meta.next.startsWith("//")) meta.next = "/feed";
  return meta;
}
