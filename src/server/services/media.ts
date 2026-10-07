import { eq, or } from "drizzle-orm";
import type { SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { activityPhotos, users } from "@/server/db/schema";
import { notFound } from "@/server/http/errors";
import { getStorage, type StoredObject } from "@/server/storage";
import { getVisibleActivityRow } from "./activities";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_KEY = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]{3,200}$/;

/**
 * Authorise access to a stored object by key prefix:
 *  - avatars/<userId>/…   visible to anyone signed in or not, but only for active accounts
 *  - activities/<id>/…    only when the viewer can see that activity
 *  - progress|food|exports/<userId>/…   owner only
 * Anything else is a 404 (we never reveal whether a private object exists).
 */
export async function openMedia(viewer: SessionUser | null, key: string): Promise<StoredObject> {
  if (!SAFE_KEY.test(key) || key.includes("..") || key.includes("//")) throw notFound("Media");
  const [prefix, ownerOrId] = key.split("/");

  if (prefix === "avatars") {
    if (!UUID.test(ownerOrId)) throw notFound("Media");
    const [u] = await getDb().select({ status: users.status }).from(users).where(eq(users.id, ownerOrId)).limit(1);
    if (!u || u.status !== "active") throw notFound("Media");
  } else if (prefix === "activities") {
    const [photo] = await getDb()
      .select({ activityId: activityPhotos.activityId })
      .from(activityPhotos)
      .where(or(eq(activityPhotos.storageKey, key), eq(activityPhotos.thumbnailKey, key)))
      .limit(1);
    if (!photo) throw notFound("Media");
    try {
      await getVisibleActivityRow(viewer?.id ?? null, photo.activityId);
    } catch {
      throw notFound("Media");
    }
  } else if (["progress", "food", "exports"].includes(prefix)) {
    if (!viewer || viewer.id !== ownerOrId) throw notFound("Media");
  } else {
    throw notFound("Media");
  }

  const obj = await getStorage().get(key);
  if (!obj) throw notFound("Media");
  return obj;
}

/** Private objects must never be cached by shared caches. */
export const isPrivatePrefix = (key: string) => !key.startsWith("avatars/");
