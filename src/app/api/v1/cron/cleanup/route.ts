import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { lt } from "drizzle-orm";
import { purgeExpiredRateLimits } from "@/server/auth/rate-limit";
import { config } from "@/server/config";
import { getDb } from "@/server/db";
import { authTokens, sessions } from "@/server/db/schema";
import { cleanupScans } from "@/server/services/foodscan";

function authorised(req: NextRequest) {
  const secret = config.cronSecret;
  if (!secret) return !config.isProd; // never open in production without a secret
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Daily maintenance (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). */
export async function GET(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ success: false }, { status: 401 });
  const db = getDb();
  const now = new Date();
  const [expiredSessions, expiredTokens] = await Promise.all([
    db.delete(sessions).where(lt(sessions.expiresAt, now)).returning({ id: sessions.id }),
    db.delete(authTokens).where(lt(authTokens.expiresAt, now)).returning({ id: authTokens.id }),
  ]);
  await purgeExpiredRateLimits();
  const scans = await cleanupScans();
  return NextResponse.json({ success: true, data: { sessions: expiredSessions.length, tokens: expiredTokens.length, ...scans } });
}
