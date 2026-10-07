import { and, desc, eq } from "drizzle-orm";
import type { SessionUser } from "@/server/auth/session";
import { config } from "@/server/config";
import { getDb } from "@/server/db";
import { externalActivities, externalConnections, workouts } from "@/server/db/schema";
import { ApiError, badRequest, notFound } from "@/server/http/errors";
import { writeAudit } from "./audit";

const TOKEN_URL = "https://www.strava.com/oauth/token";
const API = "https://www.strava.com/api/v3";

type TokenPayload = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number; firstname?: string; lastname?: string };
};

type StravaActivity = {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  start_date: string;
  elapsed_time: number;
  distance?: number;
  calories?: number;
};

export function stravaRedirectUri() {
  return `${config.appUrl}/api/v1/integrations/strava/callback`;
}

export async function exchangeStravaCode(code: string): Promise<TokenPayload> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.strava.clientId,
      client_secret: config.strava.clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new ApiError(401, "OAUTH_FAILED", "Strava authorization failed");
  return res.json() as Promise<TokenPayload>;
}

export async function saveStravaConnection(user: SessionUser, tokens: TokenPayload) {
  if (!tokens.athlete?.id) throw new ApiError(401, "OAUTH_FAILED", "Strava did not return an athlete");
  const db = getDb();
  const athleteName = [tokens.athlete.firstname, tokens.athlete.lastname].filter(Boolean).join(" ") || null;
  const values = {
    userId: user.id,
    provider: "STRAVA" as const,
    externalUserId: String(tokens.athlete.id),
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiresAt: new Date(tokens.expires_at * 1000),
    scope: "activity:read",
    athleteName,
  };
  const [existing] = await db.select({ id: externalConnections.id }).from(externalConnections).where(and(eq(externalConnections.userId, user.id), eq(externalConnections.provider, "STRAVA"))).limit(1);
  if (existing) await db.update(externalConnections).set({ ...values, updatedAt: new Date() }).where(eq(externalConnections.id, existing.id));
  else await db.insert(externalConnections).values(values);
  await writeAudit({ userId: user.id, action: "strava.connect", entityType: "connection", entityId: String(tokens.athlete.id) });
}

async function liveConnection(userId: string) {
  const db = getDb();
  const [row] = await db.select().from(externalConnections).where(and(eq(externalConnections.userId, userId), eq(externalConnections.provider, "STRAVA"))).limit(1);
  if (!row) throw notFound("Strava connection");
  if (row.tokenExpiresAt.getTime() - 60_000 > Date.now()) return row;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.strava.clientId,
      client_secret: config.strava.clientSecret,
      grant_type: "refresh_token",
      refresh_token: row.refreshToken,
    }),
  });
  if (!res.ok) throw new ApiError(401, "STRAVA_EXPIRED", "Reconnect Strava to keep syncing");
  const tokens = (await res.json()) as TokenPayload;
  const [updated] = await db
    .update(externalConnections)
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || row.refreshToken,
      tokenExpiresAt: new Date(tokens.expires_at * 1000),
      updatedAt: new Date(),
    })
    .where(eq(externalConnections.id, row.id))
    .returning();
  return updated!;
}

export async function stravaStatus(userId: string) {
  const [row] = await getDb()
    .select({ athleteName: externalConnections.athleteName, lastSyncedAt: externalConnections.lastSyncedAt, createdAt: externalConnections.createdAt })
    .from(externalConnections)
    .where(and(eq(externalConnections.userId, userId), eq(externalConnections.provider, "STRAVA")))
    .limit(1);
  return row ? { connected: true as const, athleteName: row.athleteName, lastSyncedAt: row.lastSyncedAt, connectedAt: row.createdAt } : { connected: false as const };
}

export async function syncStrava(user: SessionUser, opts: { backfill?: boolean } = {}) {
  const conn = await liveConnection(user.id);
  const db = getDb();
  const after = opts.backfill || !conn.lastSyncedAt ? Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000) : Math.floor((conn.lastSyncedAt.getTime() - 24 * 60 * 60 * 1000) / 1000);
  let page = 1;
  let imported = 0;
  let skipped = 0;
  while (page <= 8) {
    const res = await fetch(`${API}/athlete/activities?after=${after}&per_page=50&page=${page}`, { headers: { Authorization: `Bearer ${conn.accessToken}` } });
    if (!res.ok) throw new ApiError(502, "STRAVA_ERROR", "Couldn't read activities from Strava");
    const batch = (await res.json()) as StravaActivity[];
    if (batch.length === 0) break;
    for (const a of batch) {
      const [dupe] = await db
        .select({ id: externalActivities.id })
        .from(externalActivities)
        .where(and(eq(externalActivities.provider, "STRAVA"), eq(externalActivities.externalActivityId, String(a.id)), eq(externalActivities.userId, user.id)))
        .limit(1);
      if (dupe) {
        skipped++;
        continue;
      }
      const startedAt = new Date(a.start_date);
      const [w] = await db
        .insert(workouts)
        .values({
          userId: user.id,
          title: a.name || a.sport_type || a.type || "Strava activity",
          status: "COMPLETED",
          startedAt,
          completedAt: new Date(startedAt.getTime() + a.elapsed_time * 1000),
          durationSeconds: a.elapsed_time,
          caloriesBurnedEstimate: a.calories ?? null,
          exerciseCount: 0,
          setCount: 0,
          repCount: 0,
          volume: 0,
          prCount: 0,
          notes: a.distance ? `Imported from Strava · ${Math.round((a.distance / 1000) * 100) / 100} km · ${a.sport_type ?? a.type}` : `Imported from Strava · ${a.sport_type ?? a.type}`,
          source: "STRAVA",
        })
        .returning({ id: workouts.id });
      await db.insert(externalActivities).values({ userId: user.id, provider: "STRAVA", externalActivityId: String(a.id), workoutId: w.id });
      imported++;
    }
    if (batch.length < 50) break;
    page++;
  }
  await db.update(externalConnections).set({ lastSyncedAt: new Date(), updatedAt: new Date() }).where(eq(externalConnections.id, conn.id));
  await writeAudit({ userId: user.id, action: "strava.sync", entityType: "connection", entityId: conn.id, metadata: { imported, skipped } });
  return { imported, skipped };
}

export async function disconnectStrava(user: SessionUser) {
  const db = getDb();
  const [row] = await db.select().from(externalConnections).where(and(eq(externalConnections.userId, user.id), eq(externalConnections.provider, "STRAVA"))).limit(1);
  if (!row) return { disconnected: true };
  try {
    await fetch("https://www.strava.com/oauth/deauthorize", { method: "POST", headers: { Authorization: `Bearer ${row.accessToken}` } });
  } catch {
    /* still drop the local connection */
  }
  await db.delete(externalConnections).where(eq(externalConnections.id, row.id));
  await writeAudit({ userId: user.id, action: "strava.disconnect", entityType: "connection", entityId: row.id });
  return { disconnected: true };
}

export async function listRecentImports(userId: string, limit = 10) {
  return getDb()
    .select({
      id: workouts.id,
      title: workouts.title,
      startedAt: workouts.startedAt,
      durationSeconds: workouts.durationSeconds,
      externalActivityId: externalActivities.externalActivityId,
    })
    .from(externalActivities)
    .innerJoin(workouts, eq(workouts.id, externalActivities.workoutId))
    .where(and(eq(externalActivities.userId, userId), eq(externalActivities.provider, "STRAVA")))
    .orderBy(desc(externalActivities.importedAt))
    .limit(limit);
}

export async function handleStravaWebhook(body: { owner_id?: number; object_type?: string; aspect_type?: string; object_id?: number }) {
  if (body.object_type !== "activity" || !body.owner_id || !body.object_id) return;
  if (body.aspect_type === "delete") return;
  const [conn] = await getDb()
    .select()
    .from(externalConnections)
    .where(and(eq(externalConnections.provider, "STRAVA"), eq(externalConnections.externalUserId, String(body.owner_id))))
    .limit(1);
  if (!conn) return;
  const sessionLike = { id: conn.userId } as SessionUser;
  await syncStrava(sessionLike, { backfill: false }).catch(() => undefined);
}

export function requireStravaConfigured() {
  if (!config.strava.configured) throw badRequest("Strava is not configured on this server");
}
