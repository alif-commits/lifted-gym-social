import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { MAX_ACTIVITY_PHOTOS } from "@/lib/constants";
import { extractHashtags, extractMentions } from "@/lib/text-entities";
import type { UpdateActivityInput } from "@/lib/validators/activity";
import type { SessionUser } from "@/server/auth/session";
import { getDb, type DbOrTx } from "@/server/db";
import {
  activities,
  activityHashtags,
  activityPhotos,
  bookmarks,
  hashtags,
  likes,
  mentions,
  userSettings,
  users,
  workouts,
  type ActivitySummaryItem,
} from "@/server/db/schema";
import { ApiError, badRequest, conflict, forbidden, notFound } from "@/server/http/errors";
import { decodeCursor, encodeCursor, type Page } from "@/server/lib/cursor";
import { shortId } from "@/server/lib/ids";
import { getStorage, mediaUrl } from "@/server/storage";
import { snapshotFromExercises } from "./activity-snapshot";
import { userSummary, type UserSummaryDto } from "./dto";
import { processImage, storeImagePair } from "./images";
import { notify } from "./notifications";
import { activityVisibleTo } from "./visibility";
import { getWorkout, toCalcExercises } from "./workouts";

type ActivityRow = typeof activities.$inferSelect;

export type ActivityPhotoDto = { id: string; url: string; thumbUrl: string; width: number; height: number };

export type ActivityCardDto = {
  id: string;
  shortId: string;
  status: string;
  user: UserSummaryDto;
  title: string;
  description: string | null;
  visibility: string;
  showExerciseDetails: boolean;
  startedAt: Date;
  publishedAt: Date | null;
  durationSeconds: number | null;
  exerciseCount: number;
  setCount: number;
  repCount: number;
  volume: number | null;
  prCount: number;
  caloriesBurnedEstimate: number | null;
  locationName: string | null;
  summary: ActivitySummaryItem[];
  photos: ActivityPhotoDto[];
  hashtags: string[];
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  isOwner: boolean;
};

type CardRow = { a: ActivityRow; u: typeof users.$inferSelect; likes: number; comments: number };

/** Base select for activity cards; callers add where/order/limit. */
export function cardSelect() {
  return getDb()
    .select({
      a: activities,
      u: users,
      likes: sql<number>`(select count(*)::int from likes l where l.activity_id = ${activities.id})`,
      comments: sql<number>`(select count(*)::int from comments c where c.activity_id = ${activities.id} and c.deleted_at is null)`,
    })
    .from(activities)
    .innerJoin(users, eq(users.id, activities.userId))
    .innerJoin(userSettings, eq(userSettings.userId, users.id));
}

/** Turn rows into privacy-aware DTOs with batched photo/tag/like lookups. */
export async function buildCards(viewerId: string | null, rows: CardRow[], opts: { photoLimit?: number } = {}): Promise<ActivityCardDto[]> {
  if (rows.length === 0) return [];
  const db = getDb();
  const ids = rows.map((r) => r.a.id);
  const [photoRows, tagRows, likedRows, bookmarkRows] = await Promise.all([
    db.select().from(activityPhotos).where(inArray(activityPhotos.activityId, ids)).orderBy(asc(activityPhotos.sortOrder), asc(activityPhotos.createdAt)),
    db
      .select({ activityId: activityHashtags.activityId, tag: hashtags.tag })
      .from(activityHashtags)
      .innerJoin(hashtags, eq(hashtags.id, activityHashtags.hashtagId))
      .where(inArray(activityHashtags.activityId, ids)),
    viewerId ? db.select({ id: likes.activityId }).from(likes).where(and(eq(likes.userId, viewerId), inArray(likes.activityId, ids))) : Promise.resolve([]),
    viewerId ? db.select({ id: bookmarks.activityId }).from(bookmarks).where(and(eq(bookmarks.userId, viewerId), inArray(bookmarks.activityId, ids))) : Promise.resolve([]),
  ]);
  const liked = new Set(likedRows.map((r) => r.id));
  const marked = new Set(bookmarkRows.map((r) => r.id));
  const photosBy = new Map<string, ActivityPhotoDto[]>();
  for (const p of photoRows) {
    const list = photosBy.get(p.activityId) ?? [];
    if (!opts.photoLimit || list.length < opts.photoLimit) {
      list.push({ id: p.id, url: mediaUrl(p.storageKey)!, thumbUrl: mediaUrl(p.thumbnailKey)!, width: p.width, height: p.height });
    }
    photosBy.set(p.activityId, list);
  }
  const tagsBy = new Map<string, string[]>();
  for (const t of tagRows) tagsBy.set(t.activityId, [...(tagsBy.get(t.activityId) ?? []), t.tag]);

  return rows.map(({ a, u, likes: likesCount, comments: commentsCount }) => {
    const isOwner = a.userId === viewerId;
    return {
      id: a.id,
      shortId: a.shortId,
      status: a.status,
      user: userSummary(u),
      title: a.title,
      description: a.description,
      visibility: a.visibility,
      showExerciseDetails: a.showExerciseDetails,
      startedAt: a.startedAt,
      publishedAt: a.publishedAt,
      durationSeconds: a.durationSeconds,
      exerciseCount: a.exerciseCount,
      setCount: a.setCount,
      repCount: a.repCount,
      volume: a.volume,
      prCount: a.prCount,
      caloriesBurnedEstimate: a.caloriesBurnedEstimate,
      locationName: a.locationName,
      // Privacy-aware serialisation: set-level highlights only when the owner allows it.
      summary: isOwner || a.showExerciseDetails ? a.summary : [],
      photos: photosBy.get(a.id) ?? [],
      hashtags: tagsBy.get(a.id) ?? [],
      likesCount,
      commentsCount,
      likedByMe: liked.has(a.id),
      bookmarkedByMe: marked.has(a.id),
      isOwner,
    };
  });
}

/** Fetch one activity (by uuid or short id) if — and only if — the viewer may see it. */
export async function getVisibleActivityRow(viewerId: string | null, idOrShort: string): Promise<CardRow> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrShort);
  const [row] = await cardSelect()
    .where(and(isUuid ? eq(activities.id, idOrShort) : eq(activities.shortId, idOrShort), activityVisibleTo(viewerId)))
    .limit(1);
  if (!row) throw notFound("Activity");
  return row;
}

export async function getActivityCard(viewerId: string | null, idOrShort: string): Promise<ActivityCardDto> {
  const row = await getVisibleActivityRow(viewerId, idOrShort);
  const [card] = await buildCards(viewerId, [row]);
  return card;
}

export type ActivityDetailDto = ActivityCardDto & {
  /** Only populated for the owner (used to link back to the private workout / edit screen). */
  workoutId: string | null;
  exercises: Array<{
    exerciseId: string;
    name: string;
    sets: Array<{ setNumber: number; setType: string; weight: number | null; reps: number | null; durationSeconds: number | null; distance: number | null; rpe: number | null }>;
  }> | null;
};

/** Activity page: card + (optionally) exercise/set detail. Never exposes private notes. */
export async function getActivityDetail(viewerId: string | null, idOrShort: string): Promise<ActivityDetailDto> {
  const row = await getVisibleActivityRow(viewerId, idOrShort);
  const [card] = await buildCards(viewerId, [row]);
  let exercises: ActivityDetailDto["exercises"] = null;
  if ((card.isOwner || card.showExerciseDetails) && row.a.workoutId) {
    const [w] = await getDb().select({ id: workouts.id, userId: workouts.userId }).from(workouts).where(eq(workouts.id, row.a.workoutId)).limit(1);
    if (w) {
      const wk = await getWorkout(w.userId, w.id);
      exercises = wk.exercises
        .map((e) => ({
          exerciseId: e.exerciseId,
          name: e.exercise.name,
          sets: e.sets
            .filter((s) => s.completed)
            .map((s) => ({ setNumber: s.setNumber, setType: s.setType, weight: s.weight, reps: s.reps, durationSeconds: s.durationSeconds, distance: s.distance, rpe: s.rpe })),
        }))
        .filter((e) => e.sets.length > 0);
    }
  }
  return { ...card, workoutId: card.isOwner ? row.a.workoutId : null, exercises };
}

/* --------------------------------- Owner ops -------------------------------- */

async function requireOwnActivity(db: DbOrTx, userId: string, id: string): Promise<ActivityRow> {
  const [a] = await db.select().from(activities).where(eq(activities.id, id)).limit(1);
  if (!a) throw notFound("Activity");
  // Never reveal whether someone else's activity exists.
  if (a.userId !== userId) throw notFound("Activity");
  return a;
}

export async function createDraftFromWorkout(user: SessionUser, workoutId: string): Promise<ActivityCardDto> {
  const db = getDb();
  const existing = await db.select().from(activities).where(eq(activities.workoutId, workoutId)).limit(1);
  if (existing[0]) {
    if (existing[0].userId !== user.id) throw notFound("Workout");
    return getActivityCard(user.id, existing[0].id);
  }
  const workout = await getWorkout(user.id, workoutId);
  if (workout.status !== "COMPLETED") throw conflict("Finish the workout before sharing it", "WORKOUT_NOT_COMPLETED");
  const snap = snapshotFromExercises(toCalcExercises(workout.exercises));
  const [w] = await db.select().from(workouts).where(eq(workouts.id, workoutId));

  let created: ActivityRow | undefined;
  for (let attempt = 0; attempt < 4 && !created; attempt++) {
    try {
      [created] = await db
        .insert(activities)
        .values({
          shortId: shortId(8),
          userId: user.id,
          workoutId,
          status: "DRAFT",
          title: w.title,
          visibility: user.settings.defaultActivityVisibility,
          startedAt: w.startedAt,
          endedAt: w.completedAt,
          durationSeconds: w.durationSeconds,
          volume: snap.volume,
          exerciseCount: snap.exerciseCount,
          setCount: snap.setCount,
          repCount: snap.repCount,
          prCount: w.prCount ?? 0,
          caloriesBurnedEstimate: w.caloriesBurnedEstimate,
          summary: snap.summary,
        })
        .returning();
    } catch (err) {
      const e = err as { code?: string; constraint?: string };
      if (e.code === "23505" && e.constraint === "activities_workout_uq") {
        const [again] = await db.select().from(activities).where(eq(activities.workoutId, workoutId)).limit(1);
        if (again) return getActivityCard(user.id, again.id);
      }
      if (!(e.code === "23505" && e.constraint === "activities_short_id_uq")) throw err;
    }
  }
  if (!created) throw new ApiError(500, "INTERNAL_ERROR", "Could not create activity");
  return getActivityCard(user.id, created.id);
}

export async function updateActivity(user: SessionUser, id: string, patch: UpdateActivityInput): Promise<ActivityCardDto> {
  const db = getDb();
  const a = await requireOwnActivity(db, user.id, id);
  await db.update(activities).set(patch).where(eq(activities.id, id));
  if (a.status === "PUBLISHED" && (patch.title !== undefined || patch.description !== undefined)) {
    await syncEntities(db, { ...a, ...patch } as ActivityRow, user, { notifyMentions: false });
  }
  return getActivityCard(user.id, id);
}

export async function deleteActivity(user: SessionUser, id: string) {
  await requireOwnActivity(getDb(), user.id, id);
  await deleteActivityById(id);
}

/** Unchecked removal; callers must have authorised it (owner or moderator). */
export async function deleteActivityById(id: string) {
  const db = getDb();
  const photos = await db.select().from(activityPhotos).where(eq(activityPhotos.activityId, id));
  // Only the activity is removed; the underlying workout is kept (conceptually separate).
  await db.delete(activities).where(eq(activities.id, id));
  await getStorage().delete(photos.flatMap((p) => [p.storageKey, p.thumbnailKey]));
}

async function syncEntities(db: DbOrTx, a: Pick<ActivityRow, "id" | "title" | "description" | "visibility" | "userId">, user: SessionUser, opts: { notifyMentions: boolean }) {
  const tags = extractHashtags(`${a.title} ${a.description ?? ""}`);
  await db.delete(activityHashtags).where(eq(activityHashtags.activityId, a.id));
  if (tags.length) {
    await db.insert(hashtags).values(tags.map((tag) => ({ tag }))).onConflictDoNothing();
    const rows = await db.select({ id: hashtags.id }).from(hashtags).where(inArray(hashtags.tag, tags));
    await db.insert(activityHashtags).values(rows.map((r) => ({ activityId: a.id, hashtagId: r.id }))).onConflictDoNothing();
  }
  const names = extractMentions(`${a.title} ${a.description ?? ""}`);
  await db.delete(mentions).where(and(eq(mentions.activityId, a.id), eq(mentions.contextType, "ACTIVITY")));
  if (names.length) {
    const targets = await db.select({ id: users.id, username: users.username }).from(users).where(and(inArray(users.username, names), eq(users.status, "active")));
    if (targets.length) {
      await db.insert(mentions).values(targets.map((t) => ({ activityId: a.id, userId: t.id, contextType: "ACTIVITY", contextId: a.id })));
      if (opts.notifyMentions && a.visibility !== "ONLY_ME") {
        for (const t of targets) {
          await notify(
            {
              userId: t.id,
              actorId: user.id,
              type: "MENTION",
              title: "You were mentioned",
              message: `${user.displayName} mentioned you in "${a.title}"`,
              payload: { activityId: a.id },
              dedupeKey: `mention:${a.id}`,
            },
            db,
          );
        }
      }
    }
  }
}

export async function publishActivity(user: SessionUser, id: string): Promise<ActivityCardDto> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [a] = await tx.select().from(activities).where(eq(activities.id, id)).for("update");
    if (!a) throw notFound("Activity");
    if (a.userId !== user.id) throw forbidden("Only the owner can publish this activity");
    // Idempotent: publishing twice keeps the first publish time and sends no duplicate notifications.
    const first = a.status !== "PUBLISHED";
    if (first) await tx.update(activities).set({ status: "PUBLISHED", publishedAt: new Date() }).where(eq(activities.id, id));
    await syncEntities(tx, a, user, { notifyMentions: first });
  });
  return getActivityCard(user.id, id);
}

/* ---------------------------------- Photos ---------------------------------- */

export async function addActivityPhoto(user: SessionUser, activityId: string, image: Buffer): Promise<ActivityPhotoDto> {
  const db = getDb();
  await requireOwnActivity(db, user.id, activityId);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(activityPhotos).where(eq(activityPhotos.activityId, activityId));
  if (n >= MAX_ACTIVITY_PHOTOS) throw badRequest(`You can add up to ${MAX_ACTIVITY_PHOTOS} photos`, "PHOTO_LIMIT");
  const processed = await processImage(image);
  const { key, thumbKey } = await storeImagePair(`activities/${activityId}`, processed);
  const [p] = await db
    .insert(activityPhotos)
    .values({ activityId, userId: user.id, storageKey: key, thumbnailKey: thumbKey, mimeType: processed.mimeType, sizeBytes: processed.size, width: processed.width, height: processed.height, sortOrder: n })
    .returning();
  return { id: p.id, url: mediaUrl(p.storageKey)!, thumbUrl: mediaUrl(p.thumbnailKey)!, width: p.width, height: p.height };
}

export async function removeActivityPhoto(user: SessionUser, activityId: string, photoId: string) {
  const db = getDb();
  await requireOwnActivity(db, user.id, activityId);
  const [p] = await db.delete(activityPhotos).where(and(eq(activityPhotos.id, photoId), eq(activityPhotos.activityId, activityId))).returning();
  if (!p) throw notFound("Photo");
  await getStorage().delete([p.storageKey, p.thumbnailKey]);
  const rest = await db.select({ id: activityPhotos.id }).from(activityPhotos).where(eq(activityPhotos.activityId, activityId)).orderBy(asc(activityPhotos.sortOrder));
  await Promise.all(rest.map((r, i) => db.update(activityPhotos).set({ sortOrder: i }).where(eq(activityPhotos.id, r.id))));
}

/** First id becomes the cover photo. */
export async function reorderActivityPhotos(user: SessionUser, activityId: string, photoIds: string[]) {
  const db = getDb();
  await requireOwnActivity(db, user.id, activityId);
  const existing = await db.select({ id: activityPhotos.id }).from(activityPhotos).where(eq(activityPhotos.activityId, activityId));
  const set = new Set(existing.map((e) => e.id));
  if (photoIds.length !== set.size || !photoIds.every((id) => set.has(id))) throw badRequest("Photo list does not match", "PHOTO_MISMATCH");
  await db.transaction(async (tx) => {
    for (const [i, id] of photoIds.entries()) await tx.update(activityPhotos).set({ sortOrder: i }).where(eq(activityPhotos.id, id));
  });
}

/* --------------------------------- Listing ---------------------------------- */

/** Keyset-paginated list of published activities ordered by published_at desc. */
export async function listActivityCards(
  viewerId: string | null,
  extraWhere: SQL | undefined,
  limit: number,
  cursor?: string,
): Promise<Page<ActivityCardDto>> {
  const c = decodeCursor<{ t: string; id: string }>(cursor);
  const rows = await cardSelect()
    .where(
      and(
        activityVisibleTo(viewerId),
        eq(activities.status, "PUBLISHED"),
        extraWhere,
        c ? sql`(${activities.publishedAt}, ${activities.id}) < (${c.t}::timestamptz, ${c.id}::uuid)` : undefined,
      ),
    )
    .orderBy(desc(activities.publishedAt), desc(activities.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const cards = await buildCards(viewerId, page, { photoLimit: 4 });
  const last = page[page.length - 1];
  return { items: cards, next_cursor: rows.length > limit ? encodeCursor({ t: last.a.publishedAt!.toISOString(), id: last.a.id }) : null };
}

export async function listOwnDrafts(user: SessionUser) {
  const rows = await cardSelect().where(and(eq(activities.userId, user.id), eq(activities.status, "DRAFT"))).orderBy(desc(activities.createdAt)).limit(20);
  return buildCards(user.id, rows);
}

