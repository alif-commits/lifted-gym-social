import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { notifications, users } from "@/server/db/schema";
import { notFound } from "@/server/http/errors";
import { decodeCursor, encodeCursor, type Page } from "@/server/lib/cursor";
import { userSummary, type UserSummaryDto } from "./dto";

export type NotificationDto = {
  id: string;
  type: string;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
  actor: UserSummaryDto | null;
};

export async function listNotifications(user: SessionUser, limit: number, cursor?: string, unreadOnly = false): Promise<Page<NotificationDto>> {
  const c = decodeCursor<{ t: string; id: string }>(cursor);
  const rows = await getDb()
    .select({ n: notifications, actor: users })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .where(
      and(
        eq(notifications.userId, user.id),
        unreadOnly ? isNull(notifications.readAt) : undefined,
        c ? sql`(${notifications.createdAt}, ${notifications.id}) < (${c.t}::timestamptz, ${c.id}::uuid)` : undefined,
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return {
    items: page.map(({ n, actor }) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      payload: Object.fromEntries(Object.entries(n.payload).filter(([k]) => k !== "dedupeKey")),
      read: n.readAt !== null,
      createdAt: n.createdAt,
      actor: actor ? userSummary(actor) : null,
    })),
    next_cursor: rows.length > limit ? encodeCursor({ t: page[page.length - 1].n.createdAt.toISOString(), id: page[page.length - 1].n.id }) : null,
  };
}

export async function unreadCount(userId: string): Promise<number> {
  const [r] = await getDb().select({ n: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return r?.n ?? 0;
}

export async function markRead(userId: string, id: string) {
  const res = await getDb().update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, userId))).returning({ id: notifications.id });
  if (!res.length) throw notFound("Notification");
}

export async function markAllRead(userId: string) {
  await getDb().update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
