import type { Visibility } from "@/lib/constants";

/**
 * Pure privacy rules. The SQL equivalents (see server/services/visibility.ts) must stay in sync;
 * both are covered by tests.
 */

export type ViewerRelation = {
  isOwner: boolean;
  /** Viewer follows the author (accepted follow). */
  isFollower: boolean;
  /** A block exists in either direction between viewer and author. */
  blocked: boolean;
};

export type ActivityAccessInput = {
  status: string; // DRAFT | PUBLISHED
  visibility: Visibility | string;
  authorStatus: string; // active | suspended | deleted
  authorIsPrivateAccount: boolean;
};

export function canViewActivity(a: ActivityAccessInput, rel: ViewerRelation): boolean {
  if (rel.isOwner) return a.authorStatus !== "deleted";
  if (a.status !== "PUBLISHED") return false;
  if (a.authorStatus !== "active") return false;
  if (rel.blocked) return false;
  switch (a.visibility) {
    case "ONLY_ME":
      return false;
    case "FOLLOWERS":
      return rel.isFollower;
    case "PUBLIC":
      return a.authorIsPrivateAccount ? rel.isFollower : true;
    default:
      return false;
  }
}

/** Profile header (name, avatar, bio) is visible unless blocked/suspended; content depends on privacy. */
export function canViewProfile(authorStatus: string, rel: ViewerRelation): boolean {
  if (rel.isOwner) return true;
  if (authorStatus !== "active") return false;
  return !rel.blocked;
}

/** Whether a private account's content (activity list, stats) is visible. */
export function canViewProfileContent(
  author: { status: string; isPrivateAccount: boolean },
  rel: ViewerRelation,
): boolean {
  if (!canViewProfile(author.status, rel)) return false;
  if (rel.isOwner) return true;
  return !author.isPrivateAccount || rel.isFollower;
}

/**
 * Sensitive records (nutrition, weight, measurements) are owner-only unless the owner explicitly
 * widened the setting. Progress photos are always owner-only.
 */
export function canViewSensitiveData(setting: string, rel: ViewerRelation): boolean {
  if (rel.isOwner) return true;
  if (rel.blocked) return false;
  if (setting === "PUBLIC") return true;
  if (setting === "FOLLOWERS") return rel.isFollower;
  return false;
}
