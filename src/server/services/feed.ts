import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { activities, activityHashtags, exercises, hashtags, userSettings, users } from "@/server/db/schema";
import { decodeCursor, encodeCursor, type Page } from "@/server/lib/cursor";
import { toExerciseDto } from "./exercises";
import { buildCards, cardSelect, listActivityCards, type ActivityCardDto } from "./activities";
import { userSummary } from "./dto";
import { activityVisibleTo } from "./visibility";

/** Home feed: followed athletes (+ own), excluding muted users. Cursor paginated by published_at. */
export function homeFeed(user: SessionUser, limit: number, cursor?: string) {
  return listActivityCards(
    user.id,
    and(
      or(eq(activities.userId, user.id), sql`exists (select 1 from follows f where f.follower_id = ${user.id}::uuid and f.followed_id = ${activities.userId})`),
      sql`not exists (select 1 from mutes m where m.user_id = ${user.id}::uuid and m.muted_user_id = ${activities.userId})`,
    ),
    limit,
    cursor,
  );
}

export function userActivities(viewer: SessionUser | null, authorId: string, limit: number, cursor?: string) {
  return listActivityCards(viewer?.id ?? null, eq(activities.userId, authorId), limit, cursor);
}

export function hashtagActivities(viewer: SessionUser | null, tag: string, limit: number, cursor?: string) {
  return listActivityCards(
    viewer?.id ?? null,
    sql`exists (select 1 from activity_hashtags ah join hashtags h on h.id = ah.hashtag_id where ah.activity_id = ${activities.id} and h.tag = ${tag.toLowerCase()})`,
    limit,
    cursor,
  );
}

export async function bookmarkedActivities(user: SessionUser, limit: number, cursor?: string) {
  return listActivityCards(user.id, sql`exists (select 1 from bookmarks bk where bk.user_id = ${user.id}::uuid and bk.activity_id = ${activities.id})`, limit, cursor);
}

/** Discovery condition: public activities from non-private active authors, minus blocked/muted. */
function discoverable(viewer: SessionUser | null) {
  return and(
    eq(activities.visibility, "PUBLIC"),
    eq(userSettings.isPrivateAccount, false),
    viewer ? sql`not exists (select 1 from mutes m where m.user_id = ${viewer.id}::uuid and m.muted_user_id = ${activities.userId})` : undefined,
  );
}

/**
 * Explore. "recent" uses keyset pagination; "trending" ranks recent activity by engagement with
 * time decay and uses an offset cursor (the candidate set is small and bounded).
 */
export async function explore(viewer: SessionUser | null, opts: { sort: "trending" | "recent"; tag?: string; limit: number; cursor?: string }): Promise<Page<ActivityCardDto>> {
  const viewerId = viewer?.id ?? null;
  const tagFilter = opts.tag
    ? sql`exists (select 1 from activity_hashtags ah join hashtags h on h.id = ah.hashtag_id where ah.activity_id = ${activities.id} and h.tag = ${opts.tag.toLowerCase()})`
    : undefined;

  if (opts.sort === "recent") {
    const c = decodeCursor<{ t: string; id: string }>(opts.cursor);
    const rows = await cardSelect()
      .where(
        and(
          activityVisibleTo(viewerId),
          eq(activities.status, "PUBLISHED"),
          discoverable(viewer),
          tagFilter,
          c ? sql`(${activities.publishedAt}, ${activities.id}) < (${c.t}::timestamptz, ${c.id}::uuid)` : undefined,
        ),
      )
      .orderBy(desc(activities.publishedAt), desc(activities.id))
      .limit(opts.limit + 1);
    const page = rows.slice(0, opts.limit);
    const last = page[page.length - 1];
    return {
      items: await buildCards(viewerId, page, { photoLimit: 4 }),
      next_cursor: rows.length > opts.limit ? encodeCursor({ t: last.a.publishedAt!.toISOString(), id: last.a.id }) : null,
    };
  }

  const offset = Number(decodeCursor<{ o: number }>(opts.cursor)?.o ?? 0);
  const score = sql`((select count(*) from likes l where l.activity_id = ${activities.id}) + 2 * (select count(*) from comments c where c.activity_id = ${activities.id} and c.deleted_at is null) + 1)::float / power(extract(epoch from (now() - ${activities.publishedAt})) / 3600 + 2, 1.4)`;
  const rows = await cardSelect()
    .where(
      and(
        activityVisibleTo(viewerId),
        eq(activities.status, "PUBLISHED"),
        discoverable(viewer),
        tagFilter,
        sql`${activities.publishedAt} > now() - interval '30 days'`,
      ),
    )
    .orderBy(desc(score), desc(activities.id))
    .limit(opts.limit + 1)
    .offset(offset);
  const page = rows.slice(0, opts.limit);
  return {
    items: await buildCards(viewerId, page, { photoLimit: 4 }),
    next_cursor: rows.length > opts.limit && offset + opts.limit < 200 ? encodeCursor({ o: offset + opts.limit }) : null,
  };
}

export async function trendingHashtags(limit = 10) {
  const rows = await getDb()
    .select({ tag: hashtags.tag, n: sql<number>`count(*)::int` })
    .from(activityHashtags)
    .innerJoin(hashtags, eq(hashtags.id, activityHashtags.hashtagId))
    .innerJoin(activities, eq(activities.id, activityHashtags.activityId))
    .innerJoin(userSettings, eq(userSettings.userId, activities.userId))
    .where(and(eq(activities.status, "PUBLISHED"), eq(activities.visibility, "PUBLIC"), eq(userSettings.isPrivateAccount, false), sql`${activities.publishedAt} > now() - interval '30 days'`))
    .groupBy(hashtags.tag)
    .orderBy(desc(sql`count(*)`), hashtags.tag)
    .limit(limit);
  return rows;
}

/** Popular athletes the viewer does not already follow (public accounts, recently active). */
export async function suggestedAthletes(viewer: SessionUser | null, limit = 8) {
  const rows = await getDb()
    .select({
      u: users,
      followers: sql<number>`(select count(*)::int from follows f where f.followed_id = ${users.id})`,
      recent: sql<number>`(select count(*)::int from activities a where a.user_id = ${users.id} and a.status = 'PUBLISHED' and a.visibility = 'PUBLIC' and a.published_at > now() - interval '30 days')`,
    })
    .from(users)
    .innerJoin(userSettings, eq(userSettings.userId, users.id))
    .where(
      and(
        eq(users.status, "active"),
        eq(userSettings.isPrivateAccount, false),
        viewer ? sql`${users.id} <> ${viewer.id}::uuid` : undefined,
        viewer ? sql`not exists (select 1 from follows f where f.follower_id = ${viewer.id}::uuid and f.followed_id = ${users.id})` : undefined,
        viewer ? sql`not exists (select 1 from blocks b where (b.blocker_id = ${viewer.id}::uuid and b.blocked_id = ${users.id}) or (b.blocker_id = ${users.id} and b.blocked_id = ${viewer.id}::uuid))` : undefined,
        sql`exists (select 1 from activities a where a.user_id = ${users.id} and a.status = 'PUBLISHED' and a.visibility = 'PUBLIC')`,
      ),
    )
    .orderBy(desc(sql`recent`), desc(sql`followers`), users.username)
    .limit(limit);
  return rows.map((r) => ({ ...userSummary(r.u), followers: r.followers, recentActivities: r.recent }));
}

/* ----------------------------------- Search --------------------------------- */

const like = (q: string) => `%${q.replace(/[%_\\]/g, "\\$&")}%`;

export async function search(viewer: SessionUser | null, q: string, type: string, limit: number) {
  const db = getDb();
  const want = (t: string) => type === "all" || type === t;
  const viewerId = viewer?.id ?? null;

  const [userRows, activityRows, exerciseRows, tagRows] = await Promise.all([
    want("users")
      ? db
          .select({ u: users, isPrivate: userSettings.isPrivateAccount })
          .from(users)
          .innerJoin(userSettings, eq(userSettings.userId, users.id))
          .where(
            and(
              eq(users.status, "active"),
              or(ilike(users.username, like(q)), ilike(users.displayName, like(q))),
              viewer ? sql`not exists (select 1 from blocks b where (b.blocker_id = ${viewer.id}::uuid and b.blocked_id = ${users.id}) or (b.blocker_id = ${users.id} and b.blocked_id = ${viewer.id}::uuid))` : undefined,
            ),
          )
          .orderBy(sql`(${users.username} ilike ${q.replace(/[%_\\]/g, "\\$&") + "%"}) desc`, users.username)
          .limit(limit)
      : Promise.resolve([]),
    want("activities")
      ? cardSelect()
          .where(and(activityVisibleTo(viewerId), eq(activities.status, "PUBLISHED"), ilike(activities.title, like(q))))
          .orderBy(desc(activities.publishedAt))
          .limit(limit)
      : Promise.resolve([]),
    want("exercises") && viewer
      ? db
          .select()
          .from(exercises)
          .where(and(eq(exercises.active, true), or(eq(exercises.isGlobal, true), eq(exercises.ownerUserId, viewer.id)), ilike(exercises.name, like(q))))
          .orderBy(exercises.name)
          .limit(limit)
      : Promise.resolve([]),
    want("hashtags") ? db.select({ tag: hashtags.tag }).from(hashtags).where(ilike(hashtags.tag, `${q.replace(/^#/, "").replace(/[%_\\]/g, "\\$&")}%`)).orderBy(hashtags.tag).limit(limit) : Promise.resolve([]),
  ]);

  return {
    users: userRows.map((r) => ({ ...userSummary(r.u), isPrivate: r.isPrivate })),
    activities: await buildCards(viewerId, activityRows, { photoLimit: 1 }),
    exercises: exerciseRows.map((e) => toExerciseDto(e, viewerId)),
    hashtags: tagRows.map((t) => t.tag),
  };
}

