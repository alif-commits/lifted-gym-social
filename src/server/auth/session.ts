import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { config } from "@/server/config";
import { getDb } from "@/server/db";
import { sessions, userSettings, users } from "@/server/db/schema";
import { randomToken, sha256Hex } from "@/server/lib/ids";

export type SessionUserSettings = {
  timezone: string;
  unitSystem: "metric" | "imperial";
  locale: string;
  isPrivateAccount: boolean;
  defaultActivityVisibility: string;
  nutritionVisibility: string;
  weightVisibility: string;
  measurementVisibility: string;
  notificationSettings: Record<string, boolean>;
  privacySettings: Record<string, unknown>;
};

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
  role: string;
  status: string;
  emailVerifiedAt: Date | null;
  settings: SessionUserSettings;
};

export type SessionContext = { user: SessionUser; sessionId: string };

const DAY_MS = 24 * 60 * 60 * 1000;

export async function requestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || h.get("x-real-ip") || "unknown",
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  };
}

export async function createSession(userId: string): Promise<void> {
  const token = randomToken(32);
  const meta = await requestMeta();
  const expiresAt = new Date(Date.now() + config.session.ttlDays * DAY_MS);
  await getDb().insert(sessions).values({
    userId,
    tokenHash: sha256Hex(token),
    userAgent: meta.userAgent,
    ip: meta.ip.slice(0, 64),
    expiresAt,
  });
  (await cookies()).set(config.session.cookieName, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

async function loadSession(): Promise<SessionContext | null> {
  const token = (await cookies()).get(config.session.cookieName)?.value;
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select({ session: sessions, user: users, settings: userSettings })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(userSettings, eq(userSettings.userId, users.id))
    .where(and(eq(sessions.tokenHash, sha256Hex(token)), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || row.user.status !== "active") return null;

  // Sliding expiration, written at most once per day.
  if (Date.now() - row.session.lastSeenAt.getTime() > config.session.refreshAfterMs) {
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date(), expiresAt: new Date(Date.now() + config.session.ttlDays * DAY_MS) })
      .where(eq(sessions.id, row.session.id));
  }

  const s = row.settings;
  return {
    sessionId: row.session.id,
    user: {
      id: row.user.id,
      email: row.user.email,
      username: row.user.username,
      displayName: row.user.displayName,
      avatarKey: row.user.avatarKey,
      role: row.user.role,
      status: row.user.status,
      emailVerifiedAt: row.user.emailVerifiedAt,
      settings: {
        timezone: s.timezone,
        unitSystem: s.unitSystem === "imperial" ? "imperial" : "metric",
        locale: s.locale,
        isPrivateAccount: s.isPrivateAccount,
        defaultActivityVisibility: s.defaultActivityVisibility,
        nutritionVisibility: s.nutritionVisibility,
        weightVisibility: s.weightVisibility,
        measurementVisibility: s.measurementVisibility,
        notificationSettings: (s.notificationSettings ?? {}) as Record<string, boolean>,
        privacySettings: (s.privacySettings ?? {}) as Record<string, unknown>,
      },
    },
  };
}

/** Request-scoped (deduplicated across layouts/pages) session lookup for server components. */
export const getSession = cache(loadSession);

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(config.session.cookieName)?.value;
  if (token) {
    await getDb().update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, sha256Hex(token)));
  }
  jar.delete(config.session.cookieName);
}

export async function revokeAllSessions(userId: string, exceptSessionId?: string) {
  const rows = await getDb()
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  const ids = rows.map((r) => r.id).filter((id) => id !== exceptSessionId);
  if (ids.length === 0) return;
  await getDb().update(sessions).set({ revokedAt: new Date() }).where(inArray(sessions.id, ids));
}
