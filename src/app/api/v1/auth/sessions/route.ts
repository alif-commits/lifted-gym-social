import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { route, json } from "@/server/http/handler";
import { getDb } from "@/server/db";
import { sessions } from "@/server/db/schema";

export const GET = route.auth(async ({ user, sessionId }) => {
  const rows = await getDb()
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ip: sessions.ip,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.lastSeenAt));
  return json({ items: rows.map((r) => ({ ...r, current: r.id === sessionId })) });
});
