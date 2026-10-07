import { and, eq, or } from "drizzle-orm";
import type { ViewerRelation } from "@/lib/privacy";
import { getDb } from "@/server/db";
import { blocks, followRequests, follows, mutes } from "@/server/db/schema";

export type FullRelation = ViewerRelation & {
  /** Target follows the viewer. */
  followsViewer: boolean;
  /** Viewer has a pending follow request to target. */
  requested: boolean;
  muted: boolean;
  blockedByViewer: boolean;
  blockedViewer: boolean;
};

export async function getRelation(viewerId: string | null, targetId: string): Promise<FullRelation> {
  if (!viewerId) {
    return { isOwner: false, isFollower: false, blocked: false, followsViewer: false, requested: false, muted: false, blockedByViewer: false, blockedViewer: false };
  }
  if (viewerId === targetId) {
    return { isOwner: true, isFollower: true, blocked: false, followsViewer: false, requested: false, muted: false, blockedByViewer: false, blockedViewer: false };
  }
  const db = getDb();
  const [f, back, b, req, m] = await Promise.all([
    db.select({ x: follows.followerId }).from(follows).where(and(eq(follows.followerId, viewerId), eq(follows.followedId, targetId))).limit(1),
    db.select({ x: follows.followerId }).from(follows).where(and(eq(follows.followerId, targetId), eq(follows.followedId, viewerId))).limit(1),
    db
      .select({ blocker: blocks.blockerId })
      .from(blocks)
      .where(or(and(eq(blocks.blockerId, viewerId), eq(blocks.blockedId, targetId)), and(eq(blocks.blockerId, targetId), eq(blocks.blockedId, viewerId)))),
    db
      .select({ x: followRequests.id })
      .from(followRequests)
      .where(and(eq(followRequests.requesterId, viewerId), eq(followRequests.targetId, targetId), eq(followRequests.status, "PENDING")))
      .limit(1),
    db.select({ x: mutes.userId }).from(mutes).where(and(eq(mutes.userId, viewerId), eq(mutes.mutedUserId, targetId))).limit(1),
  ]);
  const blockedByViewer = b.some((r) => r.blocker === viewerId);
  const blockedViewer = b.some((r) => r.blocker === targetId);
  return {
    isOwner: false,
    isFollower: f.length > 0,
    followsViewer: back.length > 0,
    blocked: b.length > 0,
    blockedByViewer,
    blockedViewer,
    requested: req.length > 0,
    muted: m.length > 0,
  };
}
