import { and, eq, sql } from "drizzle-orm";
import type { NotificationType } from "@/lib/constants";
import { getDb, type DbOrTx } from "@/server/db";
import { blocks, notifications, userSettings } from "@/server/db/schema";
import { or } from "drizzle-orm";

type NotifyInput = {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  /** When set, an existing notification with the same actor/type/dedupeKey suppresses a new one. */
  dedupeKey?: string;
};

/**
 * Create an in-app notification. Skips self-notifications, blocked pairs, and types the user disabled.
 * Failure to notify must never fail the main operation, so callers may ignore the returned boolean.
 */
export async function notify(input: NotifyInput, db: DbOrTx = getDb()): Promise<boolean> {
  if (input.actorId && input.actorId === input.userId) return false;

  const [settings] = await db
    .select({ n: userSettings.notificationSettings })
    .from(userSettings)
    .where(eq(userSettings.userId, input.userId))
    .limit(1);
  const prefs = (settings?.n ?? {}) as Record<string, boolean>;
  if (prefs[input.type] === false) return false;

  if (input.actorId) {
    const blocked = await db
      .select({ x: blocks.blockerId })
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, input.userId), eq(blocks.blockedId, input.actorId)),
          and(eq(blocks.blockerId, input.actorId), eq(blocks.blockedId, input.userId)),
        ),
      )
      .limit(1);
    if (blocked.length) return false;
  }

  if (input.dedupeKey) {
    const existing = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, input.userId),
          eq(notifications.type, input.type),
          input.actorId ? eq(notifications.actorId, input.actorId) : sql`true`,
          sql`${notifications.payload}->>'dedupeKey' = ${input.dedupeKey}`,
        ),
      )
      .limit(1);
    if (existing.length) return false;
  }

  await db.insert(notifications).values({
    userId: input.userId,
    actorId: input.actorId ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    payload: { ...(input.payload ?? {}), ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}) },
  });
  return true;
}
