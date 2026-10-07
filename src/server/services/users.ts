import { and, count, eq, ne, sql } from "drizzle-orm";
import { USERNAME_CHANGE_COOLDOWN_DAYS } from "@/lib/constants";
import { canViewProfile, canViewProfileContent } from "@/lib/privacy";
import type { UpdateProfileInput, UpdateSettingsInput } from "@/lib/validators/profile";
import type { SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { activities, follows, profiles, userSettings, users } from "@/server/db/schema";
import { ApiError, conflict, notFound } from "@/server/http/errors";
import { getStorage, mediaUrl } from "@/server/storage";
import { writeAudit } from "./audit";
import { processImage, storeImagePair } from "./images";
import { getRelation } from "./relations";
import { achievementsFor, getAthleteStats } from "./stats";
import { activityVisibleTo } from "./visibility";

const DAY_MS = 86_400_000;

export async function findUserByUsername(username: string) {
  const [row] = await getDb()
    .select({ user: users, settings: userSettings, profile: profiles })
    .from(users)
    .innerJoin(userSettings, eq(userSettings.userId, users.id))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.username, username.toLowerCase()))
    .limit(1);
  return row ?? null;
}

type StatsVisibility = Partial<Record<"activities" | "trainingTime" | "totalVolume" | "prCount" | "streak" | "achievements", boolean>>;

export async function getPublicProfile(viewer: SessionUser | null, username: string) {
  const row = await findUserByUsername(username);
  if (!row || row.user.status === "deleted") throw notFound("Athlete");
  const rel = await getRelation(viewer?.id ?? null, row.user.id);
  if (!canViewProfile(row.user.status, rel)) throw notFound("Athlete");

  const db = getDb();
  const canViewContent = canViewProfileContent({ status: row.user.status, isPrivateAccount: row.settings.isPrivateAccount }, rel);

  const [followers, following, activityCount] = await Promise.all([
    db.select({ n: count() }).from(follows).where(eq(follows.followedId, row.user.id)),
    db.select({ n: count() }).from(follows).where(eq(follows.followerId, row.user.id)),
    canViewContent
      ? db
          .select({ n: count() })
          .from(activities)
          .innerJoin(users, eq(users.id, activities.userId))
          .innerJoin(userSettings, eq(userSettings.userId, users.id))
          .where(and(eq(activities.userId, row.user.id), eq(activities.status, "PUBLISHED"), activityVisibleTo(viewer?.id ?? null)))
      : Promise.resolve([{ n: 0 }]),
  ]);

  // Public statistics honour the owner's per-stat visibility switches.
  const visibility = ((row.settings.privacySettings as { statsVisibility?: StatsVisibility })?.statsVisibility ?? {}) as StatsVisibility;
  let stats: Partial<Awaited<ReturnType<typeof getAthleteStats>>> | null = null;
  let achievements: ReturnType<typeof achievementsFor> = [];
  if (canViewContent) {
    const all = await getAthleteStats(row.user.id, row.settings.timezone);
    const show = (k: keyof StatsVisibility) => rel.isOwner || visibility[k] === true;
    stats = {
      ...(show("activities") ? { workouts: all.workouts } : {}),
      ...(show("trainingTime") ? { trainingSeconds: all.trainingSeconds } : {}),
      ...(show("totalVolume") ? { totalVolumeKg: all.totalVolumeKg } : {}),
      ...(show("prCount") ? { prCount: all.prCount } : {}),
      ...(show("streak") ? { streakWeeks: all.streakWeeks } : {}),
    };
    if (show("achievements")) achievements = achievementsFor(all);
  }

  return {
    id: row.user.id,
    username: row.user.username,
    displayName: row.user.displayName,
    avatarUrl: mediaUrl(row.user.avatarKey),
    bio: row.profile.bio,
    joinedAt: row.user.createdAt,
    isPrivate: row.settings.isPrivateAccount,
    counts: { followers: followers[0]?.n ?? 0, following: following[0]?.n ?? 0, activities: activityCount[0]?.n ?? 0 },
    relation: {
      isOwner: rel.isOwner,
      following: rel.isFollower && !rel.isOwner,
      followsYou: rel.followsViewer,
      requested: rel.requested,
      blockedByMe: rel.blockedByViewer,
      muted: rel.muted,
    },
    canViewContent,
    stats,
    achievements,
  };
}

export async function getOwnProfile(userId: string) {
  const [row] = await getDb()
    .select({ user: users, profile: profiles })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) throw notFound("Profile");
  const p = row.profile;
  return {
    displayName: row.user.displayName,
    username: row.user.username,
    bio: p.bio,
    dateOfBirth: p.dateOfBirth,
    sex: p.sex,
    heightCm: p.heightCm,
    activityLevel: p.activityLevel,
    trainingExperience: p.trainingExperience,
    fitnessGoal: p.fitnessGoal,
    avatarUrl: mediaUrl(row.user.avatarKey),
    usernameChangedAt: row.user.usernameChangedAt,
  };
}

export async function updateProfile(user: SessionUser, input: UpdateProfileInput) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const userPatch: Partial<typeof users.$inferInsert> = {};
    if (input.displayName !== undefined) userPatch.displayName = input.displayName;
    if (input.username !== undefined && input.username !== user.username) {
      const [me] = await tx.select({ changedAt: users.usernameChangedAt }).from(users).where(eq(users.id, user.id));
      if (me?.changedAt && Date.now() - me.changedAt.getTime() < USERNAME_CHANGE_COOLDOWN_DAYS * DAY_MS) {
        throw new ApiError(429, "USERNAME_COOLDOWN", `You can change your username once every ${USERNAME_CHANGE_COOLDOWN_DAYS} days`);
      }
      const taken = await tx.select({ id: users.id }).from(users).where(and(eq(users.username, input.username), ne(users.id, user.id))).limit(1);
      if (taken.length) throw conflict("That username is taken", "USERNAME_TAKEN");
      userPatch.username = input.username;
      userPatch.usernameChangedAt = new Date();
    }
    if (Object.keys(userPatch).length) await tx.update(users).set(userPatch).where(eq(users.id, user.id));

    const profilePatch: Partial<typeof profiles.$inferInsert> = {};
    if (input.bio !== undefined) profilePatch.bio = input.bio;
    if (input.dateOfBirth !== undefined) profilePatch.dateOfBirth = input.dateOfBirth;
    if (input.sex !== undefined) profilePatch.sex = input.sex;
    if (input.heightCm !== undefined) profilePatch.heightCm = input.heightCm;
    if (input.activityLevel !== undefined) profilePatch.activityLevel = input.activityLevel;
    if (input.trainingExperience !== undefined) profilePatch.trainingExperience = input.trainingExperience;
    if (input.fitnessGoal !== undefined) profilePatch.fitnessGoal = input.fitnessGoal;
    if (Object.keys(profilePatch).length) await tx.update(profiles).set(profilePatch).where(eq(profiles.userId, user.id));
  });
  return getOwnProfile(user.id);
}

export async function updateSettings(user: SessionUser, input: UpdateSettingsInput) {
  const { statsVisibility, notificationSettings, ...rest } = input;
  const patch: Partial<typeof userSettings.$inferInsert> = { ...rest };
  if (notificationSettings) patch.notificationSettings = { ...user.settings.notificationSettings, ...notificationSettings };
  if (statsVisibility) {
    const current = (user.settings.privacySettings.statsVisibility ?? {}) as Record<string, boolean>;
    patch.privacySettings = { ...user.settings.privacySettings, statsVisibility: { ...current, ...statsVisibility } };
  }
  if (Object.keys(patch).length) {
    await getDb().update(userSettings).set(patch).where(eq(userSettings.userId, user.id));
  }
}

export async function setAvatar(user: SessionUser, image: Buffer) {
  const processed = await processImage(image, { maxEdge: 512, thumbEdge: 128 });
  const { key, thumbKey } = await storeImagePair(`avatars/${user.id}`, processed);
  const previous = user.avatarKey;
  await getDb().update(users).set({ avatarKey: key }).where(eq(users.id, user.id));
  const stale = previous ? [previous, previous.replace(/\.webp$/, "_thumb.webp")] : [];
  // The thumbnail is unused for avatars; drop it right away to avoid orphaned objects.
  await getStorage().delete([thumbKey, ...stale]);
  await writeAudit({ userId: user.id, action: "profile.avatar_update", entityType: "user", entityId: user.id });
  return mediaUrl(key);
}

export async function removeAvatar(user: SessionUser) {
  if (!user.avatarKey) return;
  await getDb().update(users).set({ avatarKey: null }).where(eq(users.id, user.id));
  await getStorage().delete([user.avatarKey]);
}

export async function isUsernameAvailable(username: string) {
  const r = await getDb().select({ n: sql<number>`1` }).from(users).where(eq(users.username, username)).limit(1);
  return r.length === 0;
}
