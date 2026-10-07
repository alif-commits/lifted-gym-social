import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { verifyPassword } from "@/server/auth/password";
import { destroyCurrentSession, type SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import {
  activities,
  activityPhotos,
  bodyMeasurements,
  calorieGoals,
  dataExports,
  exercises,
  fitnessGoals,
  foodScans,
  nutritionEntries,
  personalRecords,
  profiles,
  progressPhotos,
  userSettings,
  users,
  weightRecords,
  workoutExercises,
  workoutSets,
  workouts,
} from "@/server/db/schema";
import { ApiError, badRequest, conflict, notFound } from "@/server/http/errors";
import { getStorage } from "@/server/storage";
import { writeAudit } from "./audit";
import { after } from "next/server";

/* ---------------------------------- Export --------------------------------- */

const EXPORT_TTL_DAYS = 2;

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v);
  // Neutralise spreadsheet formula injection in user-controlled text.
  const safe = /^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

async function collect(userId: string) {
  const db = getDb();
  const [user] = await db.select({ email: users.email, username: users.username, displayName: users.displayName, createdAt: users.createdAt }).from(users).where(eq(users.id, userId));
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  const ws = await db.select().from(workouts).where(eq(workouts.userId, userId));
  const wes = ws.length ? await db.select({ we: workoutExercises, name: exercises.name }).from(workoutExercises).innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId)).where(inArray(workoutExercises.workoutId, ws.map((w) => w.id))) : [];
  const sets = wes.length ? await db.select().from(workoutSets).where(inArray(workoutSets.workoutExerciseId, wes.map((x) => x.we.id))) : [];
  const [acts, weights, measurements, goals, nutrition, prs, calGoals] = await Promise.all([
    db.select().from(activities).where(eq(activities.userId, userId)),
    db.select().from(weightRecords).where(eq(weightRecords.userId, userId)),
    db.select().from(bodyMeasurements).where(eq(bodyMeasurements.userId, userId)),
    db.select().from(fitnessGoals).where(eq(fitnessGoals.userId, userId)),
    db.select().from(nutritionEntries).where(eq(nutritionEntries.userId, userId)),
    db.select().from(personalRecords).where(eq(personalRecords.userId, userId)),
    db.select().from(calorieGoals).where(eq(calorieGoals.userId, userId)),
  ]);
  return { user, profile: profile ?? null, settings: settings ?? null, workouts: ws, wes, sets, activities: acts, weights, measurements, goals, nutrition, prs, calGoals };
}

function toJson(d: Awaited<ReturnType<typeof collect>>) {
  const setsBy = (weId: string) => d.sets.filter((s) => s.workoutExerciseId === weId).sort((a, b) => a.setNumber - b.setNumber);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      account: d.user,
      profile: d.profile,
      settings: d.settings,
      workouts: d.workouts.map((w) => ({
        ...w,
        exercises: d.wes.filter((x) => x.we.workoutId === w.id).sort((a, b) => a.we.orderIndex - b.we.orderIndex).map((x) => ({ name: x.name, restSeconds: x.we.restSeconds, sets: setsBy(x.we.id) })),
      })),
      activities: d.activities.map((a) => ({ id: a.id, title: a.title, description: a.description, visibility: a.visibility, publishedAt: a.publishedAt })),
      personalRecords: d.prs,
      nutritionEntries: d.nutrition,
      calorieGoals: d.calGoals,
      weights: d.weights,
      measurements: d.measurements,
      goals: d.goals,
    },
    null,
    2,
  );
}

/** Flat workout log: the most useful table for spreadsheets. */
function toCsv(d: Awaited<ReturnType<typeof collect>>) {
  const header = ["date", "workout", "exercise", "set", "type", "weight_kg", "reps", "duration_s", "distance_m", "rpe", "completed"];
  const rows: string[] = [header.join(",")];
  const wById = new Map(d.workouts.map((w) => [w.id, w]));
  for (const x of d.wes) {
    const w = wById.get(x.we.workoutId)!;
    for (const s of d.sets.filter((s) => s.workoutExerciseId === x.we.id).sort((a, b) => a.setNumber - b.setNumber)) {
      rows.push([w.startedAt, w.title, x.name, s.setNumber, s.setType, s.weight, s.reps, s.durationSeconds, s.distance, s.rpe, s.completed].map(csvCell).join(","));
    }
  }
  return rows.join("\n");
}

export async function requestExport(user: SessionUser, format: "JSON" | "CSV") {
  const db = getDb();
  const [pending] = await db.select({ id: dataExports.id }).from(dataExports).where(and(eq(dataExports.userId, user.id), eq(dataExports.status, "PENDING"), gt(dataExports.createdAt, new Date(Date.now() - 10 * 60_000)))).limit(1);
  if (pending) throw conflict("An export is already being prepared", "EXPORT_IN_PROGRESS");
  const [row] = await db
    .insert(dataExports)
    .values({ userId: user.id, format, status: "PENDING", expiresAt: new Date(Date.now() + EXPORT_TTL_DAYS * 86_400_000) })
    .returning();
  after(() => buildExport(row.id).catch(() => undefined));
  return exportDto(row);
}

async function buildExport(id: string) {
  const db = getDb();
  const [row] = await db.select().from(dataExports).where(eq(dataExports.id, id)).limit(1);
  if (!row || row.status !== "PENDING") return;
  try {
    const data = await collect(row.userId);
    const body = Buffer.from(row.format === "CSV" ? toCsv(data) : toJson(data), "utf8");
    const key = `exports/${row.userId}/${id}.${row.format === "CSV" ? "csv" : "json"}`;
    await getStorage().put(key, body, row.format === "CSV" ? "text/csv" : "application/json");
    await db.update(dataExports).set({ status: "READY", storageKey: key, sizeBytes: body.length, completedAt: new Date() }).where(eq(dataExports.id, id));
  } catch (e) {
    console.error(`[export] ${id} failed: ${(e as Error).message}`);
    await db.update(dataExports).set({ status: "FAILED", errorCode: "EXPORT_FAILED", completedAt: new Date() }).where(eq(dataExports.id, id));
  }
}

const exportDto = (r: typeof dataExports.$inferSelect) => ({
  id: r.id,
  format: r.format,
  status: r.status,
  sizeBytes: r.sizeBytes,
  createdAt: r.createdAt,
  expiresAt: r.expiresAt,
  downloadUrl: r.status === "READY" && r.storageKey ? `/api/v1/me/exports/${r.id}/download` : null,
});

export async function listExports(userId: string) {
  const rows = await getDb().select().from(dataExports).where(eq(dataExports.userId, userId)).orderBy(desc(dataExports.createdAt)).limit(20);
  return rows.map(exportDto);
}

export async function getExportFile(userId: string, id: string) {
  const [row] = await getDb().select().from(dataExports).where(eq(dataExports.id, id)).limit(1);
  if (!row || row.userId !== userId) throw notFound("Export");
  if (row.status !== "READY" || !row.storageKey) throw conflict("Export isn't ready yet", "NOT_READY");
  if (row.expiresAt && row.expiresAt < new Date()) throw new ApiError(410, "EXPIRED", "This export has expired. Request a new one.");
  const file = await getStorage().get(row.storageKey);
  if (!file) throw notFound("Export file");
  return { file, filename: `lifted-export-${row.createdAt.toISOString().slice(0, 10)}.${row.format === "CSV" ? "csv" : "json"}` };
}

/* ---------------------------- Account deletion ----------------------------- */

/** Permanently delete the account and all of its data, including stored media. */
export async function deleteAccount(user: SessionUser, password: string) {
  const db = getDb();
  if (user.role !== "user") throw badRequest("Staff accounts must be demoted before deletion", "STAFF_ACCOUNT");
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id));
  if (!row || !(await verifyPassword(row.hash, password))) throw new ApiError(403, "INVALID_CREDENTIALS", "Your password is incorrect");

  const [photos, progress, scans, exps] = await Promise.all([
    db.select({ a: activityPhotos.storageKey, b: activityPhotos.thumbnailKey }).from(activityPhotos).where(eq(activityPhotos.userId, user.id)),
    db.select({ a: progressPhotos.storageKey, b: progressPhotos.thumbnailKey }).from(progressPhotos).where(eq(progressPhotos.userId, user.id)),
    db.select({ a: foodScans.storageKey }).from(foodScans).where(eq(foodScans.userId, user.id)),
    db.select({ a: dataExports.storageKey }).from(dataExports).where(eq(dataExports.userId, user.id)),
  ]);
  const keys = [
    user.avatarKey,
    ...photos.flatMap((p) => [p.a, p.b]),
    ...progress.flatMap((p) => [p.a, p.b]),
    ...scans.map((s) => s.a),
    ...exps.map((e) => e.a),
  ].filter((k): k is string => Boolean(k));

  await writeAudit({ userId: user.id, action: "account.delete", entityType: "user", entityId: user.id });
  await db.delete(users).where(eq(users.id, user.id)); // cascades to every owned row
  await getStorage().delete(keys).catch((e) => console.error(`[account] media cleanup failed: ${(e as Error).message}`));
  await destroyCurrentSession().catch(() => undefined);
}
