import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { canViewProfileContent } from "@/lib/privacy";
import type { SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { blocks, followRequests, follows, mutes, users } from "@/server/db/schema";
import { badRequest, forbidden, notFound } from "@/server/http/errors";
import { decodeCursor, encodeCursor, type Page } from "@/server/lib/cursor";
import { notify } from "./notifications";
import { getRelation } from "./relations";
import { findUserByUsername } from "./users";
import { userSummary, type UserSummaryDto } from "./dto";

export type FollowState = "NONE" | "FOLLOWING" | "REQUESTED";

async function requireTarget(username: string) {
  const row = await findUserByUsername(username);
  if (!row || row.user.status !== "active") throw notFound("Athlete");
  return row;
}

export async function follow(me: SessionUser, username: string): Promise<FollowState> {
  const target = await requireTarget(username);
  if (target.user.id === me.id) throw badRequest("You can't follow yourself", "SELF_FOLLOW");
  const rel = await getRelation(me.id, target.user.id);
  if (rel.blocked) throw forbidden("You can't follow this athlete");
  if (rel.isFollower) return "FOLLOWING";

  const db = getDb();
  if (target.settings.isPrivateAccount) {
    await db.insert(followRequests).values({ requesterId: me.id, targetId: target.user.id }).onConflictDoNothing();
    await notify({
      userId: target.user.id,
      actorId: me.id,
      type: "FOLLOW_REQUEST",
      title: "Follow request",
      message: `${me.displayName} (@${me.username}) wants to follow you`,
      payload: { username: me.username },
      dedupeKey: `follow-request:${me.id}`,
    });
    return "REQUESTED";
  }
  await db.insert(follows).values({ followerId: me.id, followedId: target.user.id }).onConflictDoNothing();
  await notify({
    userId: target.user.id,
    actorId: me.id,
    type: "NEW_FOLLOWER",
    title: "New follower",
    message: `${me.displayName} (@${me.username}) started following you`,
    payload: { username: me.username },
    dedupeKey: `follow:${me.id}`,
  });
  return "FOLLOWING";
}

export async function unfollow(me: SessionUser, username: string): Promise<FollowState> {
  const target = await requireTarget(username);
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.delete(follows).where(and(eq(follows.followerId, me.id), eq(follows.followedId, target.user.id)));
    await tx
      .delete(followRequests)
      .where(and(eq(followRequests.requesterId, me.id), eq(followRequests.targetId, target.user.id), eq(followRequests.status, "PENDING")));
  });
  return "NONE";
}

export async function removeFollower(me: SessionUser, username: string) {
  const target = await requireTarget(username);
  await getDb().delete(follows).where(and(eq(follows.followerId, target.user.id), eq(follows.followedId, me.id)));
}

export async function listFollowRequests(me: SessionUser) {
  const rows = await getDb()
    .select({ id: followRequests.id, createdAt: followRequests.createdAt, user: users })
    .from(followRequests)
    .innerJoin(users, eq(users.id, followRequests.requesterId))
    .where(and(eq(followRequests.targetId, me.id), eq(followRequests.status, "PENDING")))
    .orderBy(desc(followRequests.createdAt))
    .limit(100);
  return rows.map((r) => ({ id: r.id, createdAt: r.createdAt, user: userSummary(r.user) }));
}

export async function respondToFollowRequest(me: SessionUser, requestId: string, accept: boolean) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [req] = await tx
      .select()
      .from(followRequests)
      .where(and(eq(followRequests.id, requestId), eq(followRequests.targetId, me.id), eq(followRequests.status, "PENDING")))
      .for("update");
    if (!req) throw notFound("Follow request");
    await tx.update(followRequests).set({ status: accept ? "ACCEPTED" : "REJECTED" }).where(eq(followRequests.id, req.id));
    if (accept) {
      await tx.insert(follows).values({ followerId: req.requesterId, followedId: me.id }).onConflictDoNothing();
      await notify(
        {
          userId: req.requesterId,
          actorId: me.id,
          type: "FOLLOW_ACCEPTED",
          title: "Follow request accepted",
          message: `${me.displayName} (@${me.username}) accepted your follow request`,
          payload: { username: me.username },
        },
        tx,
      );
    }
  });
}

export async function block(me: SessionUser, username: string) {
  const target = await requireTarget(username);
  if (target.user.id === me.id) throw badRequest("You can't block yourself", "SELF_BLOCK");
  await getDb().transaction(async (tx) => {
    await tx.insert(blocks).values({ blockerId: me.id, blockedId: target.user.id }).onConflictDoNothing();
    await tx
      .delete(follows)
      .where(
        or(
          and(eq(follows.followerId, me.id), eq(follows.followedId, target.user.id)),
          and(eq(follows.followerId, target.user.id), eq(follows.followedId, me.id)),
        ),
      );
    await tx
      .update(followRequests)
      .set({ status: "REJECTED" })
      .where(
        and(
          eq(followRequests.status, "PENDING"),
          or(
            and(eq(followRequests.requesterId, me.id), eq(followRequests.targetId, target.user.id)),
            and(eq(followRequests.requesterId, target.user.id), eq(followRequests.targetId, me.id)),
          ),
        ),
      );
  });
}

export async function unblock(me: SessionUser, username: string) {
  const target = await findUserByUsername(username);
  if (!target) throw notFound("Athlete");
  await getDb().delete(blocks).where(and(eq(blocks.blockerId, me.id), eq(blocks.blockedId, target.user.id)));
}

export async function mute(me: SessionUser, username: string) {
  const target = await requireTarget(username);
  if (target.user.id === me.id) throw badRequest("You can't mute yourself", "SELF_MUTE");
  await getDb().insert(mutes).values({ userId: me.id, mutedUserId: target.user.id }).onConflictDoNothing();
}

export async function unmute(me: SessionUser, username: string) {
  const target = await findUserByUsername(username);
  if (!target) throw notFound("Athlete");
  await getDb().delete(mutes).where(and(eq(mutes.userId, me.id), eq(mutes.mutedUserId, target.user.id)));
}

export async function listBlocked(me: SessionUser): Promise<UserSummaryDto[]> {
  const rows = await getDb()
    .select({ user: users })
    .from(blocks)
    .innerJoin(users, eq(users.id, blocks.blockedId))
    .where(eq(blocks.blockerId, me.id))
    .orderBy(desc(blocks.createdAt));
  return rows.map((r) => userSummary(r.user));
}

export async function listMuted(me: SessionUser): Promise<UserSummaryDto[]> {
  const rows = await getDb()
    .select({ user: users })
    .from(mutes)
    .innerJoin(users, eq(users.id, mutes.mutedUserId))
    .where(eq(mutes.userId, me.id))
    .orderBy(desc(mutes.createdAt));
  return rows.map((r) => userSummary(r.user));
}

export type PersonRow = UserSummaryDto & { bio?: string | null; viewerState: FollowState | "SELF" };

/** Followers / following lists, respecting profile privacy and block state. */
export async function listConnections(
  viewer: SessionUser | null,
  username: string,
  kind: "followers" | "following",
  limit: number,
  cursor?: string,
): Promise<Page<PersonRow>> {
  const target = await findUserByUsername(username);
  if (!target || target.user.status !== "active") throw notFound("Athlete");
  const rel = await getRelation(viewer?.id ?? null, target.user.id);
  if (rel.blocked) throw notFound("Athlete");
  if (!canViewProfileContent({ status: target.user.status, isPrivateAccount: target.settings.isPrivateAccount }, rel)) {
    throw forbidden("This account is private");
  }

  const db = getDb();
  const c = decodeCursor<{ t: string; id: string }>(cursor);
  const anchor = kind === "followers" ? follows.followedId : follows.followerId;
  const other = kind === "followers" ? follows.followerId : follows.followedId;

  const rows = await db
    .select({ user: users, createdAt: follows.createdAt })
    .from(follows)
    .innerJoin(users, eq(users.id, other))
    .where(
      and(
        eq(anchor, target.user.id),
        eq(users.status, "active"),
        viewer
          ? sql`not exists (select 1 from blocks b where (b.blocker_id = ${viewer.id}::uuid and b.blocked_id = ${users.id}) or (b.blocker_id = ${users.id} and b.blocked_id = ${viewer.id}::uuid))`
          : sql`true`,
        c ? sql`(${follows.createdAt}, ${users.id}) < (${c.t}::timestamptz, ${c.id}::uuid)` : sql`true`,
      ),
    )
    .orderBy(desc(follows.createdAt), desc(users.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const ids = page.map((r) => r.user.id);
  const followingSet = new Set<string>();
  const requestedSet = new Set<string>();
  if (viewer && ids.length) {
    const [f, r] = await Promise.all([
      db.select({ id: follows.followedId }).from(follows).where(and(eq(follows.followerId, viewer.id), inArray(follows.followedId, ids))),
      db
        .select({ id: followRequests.targetId })
        .from(followRequests)
        .where(and(eq(followRequests.requesterId, viewer.id), eq(followRequests.status, "PENDING"), inArray(followRequests.targetId, ids))),
    ]);
    f.forEach((x) => followingSet.add(x.id));
    r.forEach((x) => requestedSet.add(x.id));
  }

  return {
    items: page.map((r) => ({
      ...userSummary(r.user),
      viewerState: r.user.id === viewer?.id ? "SELF" : followingSet.has(r.user.id) ? "FOLLOWING" : requestedSet.has(r.user.id) ? "REQUESTED" : "NONE",
    })),
    next_cursor:
      rows.length > limit ? encodeCursor({ t: page[page.length - 1].createdAt.toISOString(), id: page[page.length - 1].user.id }) : null,
  };
}


