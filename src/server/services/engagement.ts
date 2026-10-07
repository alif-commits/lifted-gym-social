import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { extractMentions } from "@/lib/text-entities";
import type { SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { activities, bookmarks, commentLikes, comments, likes, mentions, users } from "@/server/db/schema";
import { forbidden, notFound } from "@/server/http/errors";
import { decodeCursor, encodeCursor, type Page } from "@/server/lib/cursor";
import { userSummary, type UserSummaryDto } from "./dto";
import { getVisibleActivityRow } from "./activities";
import { notify } from "./notifications";

/* ----------------------------------- Likes ---------------------------------- */

async function likeCount(activityId: string) {
  const [r] = await getDb().select({ n: sql<number>`count(*)::int` }).from(likes).where(eq(likes.activityId, activityId));
  return r?.n ?? 0;
}

/** Idempotent like. Notifies the owner only when the like is new. */
export async function likeActivity(user: SessionUser, activityId: string) {
  const { a } = await getVisibleActivityRow(user.id, activityId);
  if (a.status !== "PUBLISHED") throw notFound("Activity");
  const inserted = await getDb().insert(likes).values({ userId: user.id, activityId: a.id }).onConflictDoNothing().returning({ id: likes.userId });
  if (inserted.length) {
    await notify({
      userId: a.userId,
      actorId: user.id,
      type: "ACTIVITY_LIKE",
      title: "New like",
      message: `${user.displayName} liked "${a.title}"`,
      payload: { activityId: a.id, username: user.username },
      dedupeKey: `like:${a.id}:${user.id}`,
    });
  }
  return { liked: true, likesCount: await likeCount(a.id) };
}

export async function unlikeActivity(user: SessionUser, activityId: string) {
  const { a } = await getVisibleActivityRow(user.id, activityId);
  await getDb().delete(likes).where(and(eq(likes.userId, user.id), eq(likes.activityId, a.id)));
  return { liked: false, likesCount: await likeCount(a.id) };
}

export async function listLikers(viewer: SessionUser | null, activityId: string): Promise<UserSummaryDto[]> {
  const { a } = await getVisibleActivityRow(viewer?.id ?? null, activityId);
  const rows = await getDb()
    .select({ u: users })
    .from(likes)
    .innerJoin(users, eq(users.id, likes.userId))
    .where(
      and(
        eq(likes.activityId, a.id),
        eq(users.status, "active"),
        viewer ? sql`not exists (select 1 from blocks b where (b.blocker_id = ${viewer.id}::uuid and b.blocked_id = ${users.id}) or (b.blocker_id = ${users.id} and b.blocked_id = ${viewer.id}::uuid))` : undefined,
      ),
    )
    .orderBy(desc(likes.createdAt))
    .limit(100);
  return rows.map((r) => userSummary(r.u));
}

/* --------------------------------- Bookmarks -------------------------------- */

export async function bookmarkActivity(user: SessionUser, activityId: string) {
  const { a } = await getVisibleActivityRow(user.id, activityId);
  if (a.status !== "PUBLISHED") throw notFound("Activity");
  await getDb().insert(bookmarks).values({ userId: user.id, activityId: a.id }).onConflictDoNothing();
  return { bookmarked: true };
}

export async function unbookmarkActivity(user: SessionUser, activityId: string) {
  await getDb().delete(bookmarks).where(and(eq(bookmarks.userId, user.id), eq(bookmarks.activityId, activityId)));
  return { bookmarked: false };
}

/* --------------------------------- Comments --------------------------------- */

export type CommentDto = {
  id: string;
  parentId: string | null;
  text: string;
  createdAt: Date;
  edited: boolean;
  user: UserSummaryDto;
  likesCount: number;
  likedByMe: boolean;
  canEdit: boolean;
  canDelete: boolean;
  replies: CommentDto[];
};

const notBlocked = (viewerId: string) =>
  sql`not exists (select 1 from blocks b where (b.blocker_id = ${viewerId}::uuid and b.blocked_id = ${comments.userId}) or (b.blocker_id = ${comments.userId} and b.blocked_id = ${viewerId}::uuid))`;

export async function listComments(viewer: SessionUser | null, activityId: string, limit: number, cursor?: string): Promise<Page<CommentDto>> {
  const { a } = await getVisibleActivityRow(viewer?.id ?? null, activityId);
  const db = getDb();
  const c = decodeCursor<{ t: string; id: string }>(cursor);
  const tops = await db
    .select({ c: comments, u: users })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .where(
      and(
        eq(comments.activityId, a.id),
        isNull(comments.parentCommentId),
        isNull(comments.deletedAt),
        eq(users.status, "active"),
        viewer ? notBlocked(viewer.id) : undefined,
        c ? sql`(${comments.createdAt}, ${comments.id}) > (${c.t}::timestamptz, ${c.id}::uuid)` : undefined,
      ),
    )
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .limit(limit + 1);
  const page = tops.slice(0, limit);
  const parentIds = page.map((p) => p.c.id);
  const replies = parentIds.length
    ? await db
        .select({ c: comments, u: users })
        .from(comments)
        .innerJoin(users, eq(users.id, comments.userId))
        .where(and(inArray(comments.parentCommentId, parentIds), isNull(comments.deletedAt), eq(users.status, "active"), viewer ? notBlocked(viewer.id) : undefined))
        .orderBy(asc(comments.createdAt))
        .limit(300)
    : [];

  const allIds = [...page.map((p) => p.c.id), ...replies.map((r) => r.c.id)];
  const [counts, mine] = await Promise.all([
    allIds.length
      ? db
          .select({ id: commentLikes.commentId, n: sql<number>`count(*)::int` })
          .from(commentLikes)
          .where(inArray(commentLikes.commentId, allIds))
          .groupBy(commentLikes.commentId)
      : Promise.resolve([]),
    viewer && allIds.length ? db.select({ id: commentLikes.commentId }).from(commentLikes).where(and(eq(commentLikes.userId, viewer.id), inArray(commentLikes.commentId, allIds))) : Promise.resolve([]),
  ]);
  const countBy = new Map(counts.map((x) => [x.id, x.n]));
  const likedSet = new Set(mine.map((x) => x.id));
  const isModerator = viewer && ["admin", "moderator"].includes(viewer.role);

  const toDto = (row: { c: typeof comments.$inferSelect; u: typeof users.$inferSelect }): CommentDto => ({
    id: row.c.id,
    parentId: row.c.parentCommentId,
    text: row.c.text,
    createdAt: row.c.createdAt,
    edited: row.c.updatedAt.getTime() - row.c.createdAt.getTime() > 1000,
    user: userSummary(row.u),
    likesCount: countBy.get(row.c.id) ?? 0,
    likedByMe: likedSet.has(row.c.id),
    canEdit: row.c.userId === viewer?.id,
    // Comment author, activity owner, or a moderator may delete.
    canDelete: row.c.userId === viewer?.id || a.userId === viewer?.id || Boolean(isModerator),
    replies: [],
  });
  const items = page.map(toDto);
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const r of replies) byId.get(r.c.parentCommentId!)?.replies.push(toDto(r));
  const last = page[page.length - 1];
  return { items, next_cursor: tops.length > limit ? encodeCursor({ t: last.c.createdAt.toISOString(), id: last.c.id }) : null };
}

export async function addComment(user: SessionUser, activityId: string, text: string, parentCommentId?: string): Promise<CommentDto> {
  const { a } = await getVisibleActivityRow(user.id, activityId);
  if (a.status !== "PUBLISHED") throw notFound("Activity");
  const db = getDb();

  let parent: typeof comments.$inferSelect | undefined;
  if (parentCommentId) {
    [parent] = await db.select().from(comments).where(and(eq(comments.id, parentCommentId), eq(comments.activityId, a.id), isNull(comments.deletedAt)));
    if (!parent) throw notFound("Comment");
    // Threads are one level deep: replying to a reply attaches to the thread root.
    if (parent.parentCommentId) {
      [parent] = await db.select().from(comments).where(eq(comments.id, parent.parentCommentId));
    }
  }

  const [row] = await db.insert(comments).values({ activityId: a.id, userId: user.id, text, parentCommentId: parent?.id ?? null }).returning();

  await notify({
    userId: a.userId,
    actorId: user.id,
    type: "COMMENT",
    title: "New comment",
    message: `${user.displayName}: ${text.slice(0, 100)}`,
    payload: { activityId: a.id, commentId: row.id },
  });
  if (parent && parent.userId !== a.userId) {
    await notify({
      userId: parent.userId,
      actorId: user.id,
      type: "COMMENT_REPLY",
      title: "New reply",
      message: `${user.displayName} replied: ${text.slice(0, 100)}`,
      payload: { activityId: a.id, commentId: row.id },
    });
  }
  const names = extractMentions(text);
  if (names.length) {
    const targets = await db.select({ id: users.id }).from(users).where(and(inArray(users.username, names), eq(users.status, "active")));
    for (const t of targets) {
      await db.insert(mentions).values({ activityId: a.id, userId: t.id, contextType: "COMMENT", contextId: row.id });
      await notify({
        userId: t.id,
        actorId: user.id,
        type: "MENTION",
        title: "You were mentioned",
        message: `${user.displayName} mentioned you in a comment`,
        payload: { activityId: a.id, commentId: row.id },
        dedupeKey: `mention-comment:${row.id}`,
      });
    }
  }
  return {
    id: row.id,
    parentId: row.parentCommentId,
    text: row.text,
    createdAt: row.createdAt,
    edited: false,
    user: userSummary(user),
    likesCount: 0,
    likedByMe: false,
    canEdit: true,
    canDelete: true,
    replies: [],
  };
}

async function requireComment(id: string) {
  const [c] = await getDb()
    .select({ c: comments, activityOwner: activities.userId })
    .from(comments)
    .innerJoin(activities, eq(activities.id, comments.activityId))
    .where(and(eq(comments.id, id), isNull(comments.deletedAt)))
    .limit(1);
  if (!c) throw notFound("Comment");
  return c;
}

export async function editComment(user: SessionUser, commentId: string, text: string) {
  const { c } = await requireComment(commentId);
  if (c.userId !== user.id) throw forbidden("You can only edit your own comments");
  await getDb().update(comments).set({ text }).where(eq(comments.id, commentId));
}

export async function deleteComment(user: SessionUser, commentId: string) {
  const { c, activityOwner } = await requireComment(commentId);
  const moderator = ["admin", "moderator"].includes(user.role);
  if (c.userId !== user.id && activityOwner !== user.id && !moderator) throw forbidden("You can't delete this comment");
  await getDb().update(comments).set({ deletedAt: new Date() }).where(eq(comments.id, commentId));
}

export async function likeComment(user: SessionUser, commentId: string, like: boolean) {
  const { c } = await requireComment(commentId);
  // Viewer must be able to see the parent activity.
  await getVisibleActivityRow(user.id, c.activityId);
  const db = getDb();
  if (like) await db.insert(commentLikes).values({ userId: user.id, commentId }).onConflictDoNothing();
  else await db.delete(commentLikes).where(and(eq(commentLikes.userId, user.id), eq(commentLikes.commentId, commentId)));
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(commentLikes).where(eq(commentLikes.commentId, commentId));
  return { liked: like, likesCount: r?.n ?? 0 };
}
