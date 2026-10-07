import { and, eq, or, sql, type SQL } from "drizzle-orm";
import { activities, userSettings, users } from "@/server/db/schema";

/**
 * SQL equivalent of `canViewActivity` (src/lib/privacy.ts). The query must join `users` (author)
 * and `user_settings` (author settings). Keep both implementations in sync.
 *
 * Owners can see their own activities in any state; everyone else only sees published
 * activities from active, non-blocked authors according to visibility.
 */
export function activityVisibleTo(viewerId: string | null): SQL {
  const published = and(eq(activities.status, "PUBLISHED"), eq(users.status, "active"))!;
  if (!viewerId) {
    return and(published, eq(activities.visibility, "PUBLIC"), eq(userSettings.isPrivateAccount, false))!;
  }
  const notBlocked = sql`not exists (select 1 from blocks b where (b.blocker_id = ${viewerId}::uuid and b.blocked_id = ${activities.userId}) or (b.blocker_id = ${activities.userId} and b.blocked_id = ${viewerId}::uuid))`;
  const viewerFollows = sql`exists (select 1 from follows f where f.follower_id = ${viewerId}::uuid and f.followed_id = ${activities.userId})`;
  return or(
    eq(activities.userId, viewerId),
    and(
      published,
      notBlocked,
      or(
        and(eq(activities.visibility, "PUBLIC"), or(eq(userSettings.isPrivateAccount, false), viewerFollows)),
        and(eq(activities.visibility, "FOLLOWERS"), viewerFollows),
      ),
    ),
  )!;
}

/** Users the viewer must never see content from (blocked either way). */
export function notBlockedWith(viewerId: string, userIdColumn: SQL | typeof users.id): SQL {
  return sql`not exists (select 1 from blocks b where (b.blocker_id = ${viewerId}::uuid and b.blocked_id = ${userIdColumn}) or (b.blocker_id = ${userIdColumn} and b.blocked_id = ${viewerId}::uuid))`;
}
