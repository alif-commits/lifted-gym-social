import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { estimateOneRepMax } from "@/lib/calc/one-rep-max";
import { addDaysToDateString, localDayRange, toLocalDate } from "@/lib/tz";
import { weeklyStreak } from "@/lib/streak";
import type { goalInputSchema, goalUpdateSchema, measurementInputSchema, weightInputSchema } from "@/lib/validators/progress";
import type { z } from "zod";
import type { SessionUser } from "@/server/auth/session";
import { config } from "@/server/config";
import { getDb } from "@/server/db";
import {
  bodyMeasurements,
  exercises,
  fitnessGoals,
  personalRecords,
  progressPhotos,
  weightRecords,
  workoutExercises,
  workoutSets,
  workouts,
} from "@/server/db/schema";
import { notFound } from "@/server/http/errors";
import { decodeCursor, encodeCursor, type Page } from "@/server/lib/cursor";
import { assertExercisesAccessible } from "./exercises";
import { processImage, storeImagePair } from "./images";
import { mediaUrl, getStorage } from "@/server/storage";

/* ---------------------------------- Weight --------------------------------- */

export async function addWeight(user: SessionUser, input: z.infer<typeof weightInputSchema>) {
  const [r] = await getDb()
    .insert(weightRecords)
    .values({ userId: user.id, weight: input.weightKg, unit: "kg", recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(), notes: input.notes })
    .returning();
  return { id: r.id, weightKg: r.weight, recordedAt: r.recordedAt, notes: r.notes };
}

export async function listWeights(user: SessionUser, range: string) {
  const since = rangeStart(range);
  const rows = await getDb()
    .select()
    .from(weightRecords)
    .where(and(eq(weightRecords.userId, user.id), since ? gte(weightRecords.recordedAt, since) : undefined))
    .orderBy(asc(weightRecords.recordedAt))
    .limit(1000);
  const items = rows.map((r) => ({ id: r.id, weightKg: r.weight, recordedAt: r.recordedAt, notes: r.notes }));
  const first = items[0]?.weightKg ?? null;
  const last = items[items.length - 1]?.weightKg ?? null;
  return { items, latestKg: last, changeKg: first !== null && last !== null ? Math.round((last - first) * 10) / 10 : null };
}

export async function deleteWeight(userId: string, id: string) {
  const res = await getDb().delete(weightRecords).where(and(eq(weightRecords.id, id), eq(weightRecords.userId, userId))).returning({ id: weightRecords.id });
  if (!res.length) throw notFound("Weight entry");
}

/* ------------------------------- Measurements ------------------------------ */

export async function addMeasurement(user: SessionUser, input: z.infer<typeof measurementInputSchema>) {
  const [r] = await getDb()
    .insert(bodyMeasurements)
    .values({ userId: user.id, measurementType: input.measurementType, value: input.valueCm, unit: "cm", recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(), notes: input.notes })
    .returning();
  return { id: r.id, measurementType: r.measurementType, valueCm: r.value, recordedAt: r.recordedAt, notes: r.notes };
}

export async function listMeasurements(user: SessionUser, range: string, type?: string) {
  const since = rangeStart(range);
  const rows = await getDb()
    .select()
    .from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.userId, user.id), since ? gte(bodyMeasurements.recordedAt, since) : undefined, type ? eq(bodyMeasurements.measurementType, type) : undefined))
    .orderBy(asc(bodyMeasurements.recordedAt))
    .limit(1000);
  return rows.map((r) => ({ id: r.id, measurementType: r.measurementType, valueCm: r.value, recordedAt: r.recordedAt, notes: r.notes }));
}

export async function deleteMeasurement(userId: string, id: string) {
  const res = await getDb().delete(bodyMeasurements).where(and(eq(bodyMeasurements.id, id), eq(bodyMeasurements.userId, userId))).returning({ id: bodyMeasurements.id });
  if (!res.length) throw notFound("Measurement");
}

/* ------------------------------ Progress photos ----------------------------- */

const photoDto = (p: typeof progressPhotos.$inferSelect) => ({
  id: p.id,
  photoType: p.photoType,
  imageUrl: mediaUrl(p.storageKey),
  thumbnailUrl: mediaUrl(p.thumbnailKey),
  recordedAt: p.recordedAt,
  notes: p.notes,
});

/** Progress photos are always private to their owner and never appear in feeds. */
export async function addProgressPhoto(user: SessionUser, buffer: Buffer, meta: { photoType: string; recordedAt?: string; notes: string | null }) {
  const processed = await processImage(buffer);
  const { key, thumbKey } = await storeImagePair(`progress/${user.id}`, processed);
  const [p] = await getDb()
    .insert(progressPhotos)
    .values({ userId: user.id, photoType: meta.photoType, storageKey: key, thumbnailKey: thumbKey, recordedAt: meta.recordedAt ? new Date(meta.recordedAt) : new Date(), notes: meta.notes })
    .returning();
  return photoDto(p);
}

export async function listProgressPhotos(user: SessionUser, limit: number, cursor?: string): Promise<Page<ReturnType<typeof photoDto>>> {
  const c = decodeCursor<{ t: string; id: string }>(cursor);
  const rows = await getDb()
    .select()
    .from(progressPhotos)
    .where(and(eq(progressPhotos.userId, user.id), c ? sql`(${progressPhotos.recordedAt}, ${progressPhotos.id}) < (${c.t}::timestamptz, ${c.id}::uuid)` : undefined))
    .orderBy(desc(progressPhotos.recordedAt), desc(progressPhotos.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return { items: page.map(photoDto), next_cursor: rows.length > limit ? encodeCursor({ t: page[page.length - 1].recordedAt.toISOString(), id: page[page.length - 1].id }) : null };
}

export async function deleteProgressPhoto(userId: string, id: string) {
  const [p] = await getDb().delete(progressPhotos).where(and(eq(progressPhotos.id, id), eq(progressPhotos.userId, userId))).returning();
  if (!p) throw notFound("Photo");
  await getStorage().delete([p.storageKey, p.thumbnailKey]);
}

/* ------------------------------------ Goals -------------------------------- */

type Goal = typeof fitnessGoals.$inferSelect;

async function currentValue(user: SessionUser, g: Goal): Promise<number | null> {
  const db = getDb();
  if (g.goalType === "BODY_WEIGHT") {
    const [w] = await db.select({ w: weightRecords.weight }).from(weightRecords).where(eq(weightRecords.userId, user.id)).orderBy(desc(weightRecords.recordedAt)).limit(1);
    return w?.w ?? null;
  }
  if (g.goalType === "EXERCISE_1RM" && g.exerciseId) {
    const [r] = await db
      .select({ v: sql<number>`max(${personalRecords.value})::float` })
      .from(personalRecords)
      .where(and(eq(personalRecords.userId, user.id), eq(personalRecords.exerciseId, g.exerciseId), eq(personalRecords.recordType, "ESTIMATED_1RM")));
    return r?.v ?? null;
  }
  if (g.goalType === "WORKOUT_FREQUENCY") {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(workouts).where(and(eq(workouts.userId, user.id), eq(workouts.status, "COMPLETED"), gte(workouts.startedAt, since)));
    return r?.n ?? 0;
  }
  return null;
}

/** 0..100 progress between start and target, direction-aware (works for cutting and gaining). */
export function goalPercent(start: number | null, current: number | null, target: number | null): number | null {
  if (current === null || target === null) return null;
  const from = start ?? 0;
  if (from === target) return current === target ? 100 : 0;
  const pct = ((current - from) / (target - from)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

async function goalDto(user: SessionUser, g: Goal) {
  const current = await currentValue(user, g);
  return {
    id: g.id,
    name: g.name,
    goalType: g.goalType,
    exerciseId: g.exerciseId,
    targetValue: g.targetValue,
    targetUnit: g.targetUnit,
    startValue: g.startValue,
    startDate: g.startDate,
    targetDate: g.targetDate,
    status: g.status,
    notes: g.notes,
    currentValue: current,
    percent: goalPercent(g.startValue, current, g.targetValue),
  };
}

export async function listGoals(user: SessionUser) {
  const rows = await getDb().select().from(fitnessGoals).where(eq(fitnessGoals.userId, user.id)).orderBy(desc(fitnessGoals.createdAt));
  return Promise.all(rows.map((g) => goalDto(user, g)));
}

export async function createGoal(user: SessionUser, input: z.infer<typeof goalInputSchema>) {
  if (input.exerciseId) await assertExercisesAccessible(user.id, [input.exerciseId]);
  const [g] = await getDb()
    .insert(fitnessGoals)
    .values({
      userId: user.id,
      name: input.name,
      goalType: input.goalType,
      exerciseId: input.exerciseId ?? null,
      targetValue: input.targetValue ?? null,
      targetUnit: input.targetUnit ?? null,
      startValue: input.startValue ?? null,
      startDate: toLocalDate(new Date(), user.settings.timezone),
      targetDate: input.targetDate ?? null,
      notes: input.notes,
    })
    .returning();
  return goalDto(user, g);
}

export async function updateGoal(user: SessionUser, id: string, patch: z.infer<typeof goalUpdateSchema>) {
  if (patch.exerciseId) await assertExercisesAccessible(user.id, [patch.exerciseId]);
  const { notes, ...rest } = patch;
  const [g] = await getDb()
    .update(fitnessGoals)
    .set({ ...rest, ...(notes !== undefined ? { notes } : {}) })
    .where(and(eq(fitnessGoals.id, id), eq(fitnessGoals.userId, user.id)))
    .returning();
  if (!g) throw notFound("Goal");
  return goalDto(user, g);
}

export async function deleteGoal(userId: string, id: string) {
  const res = await getDb().delete(fitnessGoals).where(and(eq(fitnessGoals.id, id), eq(fitnessGoals.userId, userId))).returning({ id: fitnessGoals.id });
  if (!res.length) throw notFound("Goal");
}

/* -------------------------------- Personal records ------------------------- */

export async function listPersonalRecords(user: SessionUser, limit = 100) {
  const rows = await getDb()
    .select({ pr: personalRecords, name: exercises.name, muscle: exercises.primaryMuscleGroup })
    .from(personalRecords)
    .innerJoin(exercises, eq(exercises.id, personalRecords.exerciseId))
    .where(eq(personalRecords.userId, user.id))
    .orderBy(desc(personalRecords.achievedAt))
    .limit(limit);
  return rows.map(({ pr, name, muscle }) => ({
    id: pr.id,
    exerciseId: pr.exerciseId,
    exerciseName: name,
    primaryMuscleGroup: muscle,
    recordType: pr.recordType,
    value: pr.value,
    previousValue: pr.previousValue,
    unit: pr.unit,
    achievedAt: pr.achievedAt,
    workoutId: pr.workoutId,
  }));
}

/* ----------------------------------- Analytics ----------------------------- */

const RANGE_DAYS: Record<string, number> = { "30d": 30, "90d": 90, "180d": 180, "365d": 365 };

function rangeStart(range: string): Date | null {
  const days = RANGE_DAYS[range];
  return days ? new Date(Date.now() - days * 86_400_000) : null;
}

export async function getAnalytics(user: SessionUser, range: string) {
  const db = getDb();
  const tz = user.settings.timezone;
  const since = rangeStart(range);
  const done = and(eq(workouts.userId, user.id), eq(workouts.status, "COMPLETED"), since ? gte(workouts.startedAt, since) : undefined);

  const weekExpr = sql<string>`date_trunc('week', ${workouts.startedAt} at time zone ${tz})::date::text`;
  const [weekly, workoutRows, muscle, topEx] = await Promise.all([
    db
      .select({
        week: weekExpr,
        workouts: sql<number>`count(*)::int`,
        volumeKg: sql<number>`coalesce(sum(${workouts.volume}),0)::float`,
        seconds: sql<number>`coalesce(sum(${workouts.durationSeconds}),0)::int`,
      })
      .from(workouts)
      .where(done)
      // Ordinal references: repeating a parameterised expression would bind it twice and Postgres rejects the mismatch.
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db.select({ at: workouts.startedAt, prs: workouts.prCount }).from(workouts).where(and(eq(workouts.userId, user.id), eq(workouts.status, "COMPLETED"))),
    db
      .select({ muscle: exercises.primaryMuscleGroup, sets: sql<number>`count(*)::int` })
      .from(workoutSets)
      .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
      .where(and(done, eq(workoutSets.completed, true), sql`${workoutSets.setType} <> 'WARMUP'`))
      .groupBy(exercises.primaryMuscleGroup)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({ exerciseId: workoutExercises.exerciseId, name: exercises.name, n: sql<number>`count(distinct ${workouts.id})::int` })
      .from(workoutExercises)
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
      .where(done)
      .groupBy(workoutExercises.exerciseId, exercises.name)
      .orderBy(desc(sql`count(distinct ${workouts.id})`))
      .limit(5),
  ]);

  // Strength progression: best estimated 1RM per session for the most-trained exercises.
  const strength: Array<{ exerciseId: string; name: string; series: Array<{ date: string; e1rm: number }> }> = [];
  if (topEx.length) {
    const sets = await db
      .select({ exerciseId: workoutExercises.exerciseId, at: workouts.startedAt, workoutId: workouts.id, weight: workoutSets.weight, reps: workoutSets.reps })
      .from(workoutSets)
      .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
      .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
      .where(and(done, inArray(workoutExercises.exerciseId, topEx.map((t) => t.exerciseId)), eq(workoutSets.completed, true), sql`${workoutSets.setType} <> 'WARMUP'`))
      .orderBy(asc(workouts.startedAt));
    for (const ex of topEx) {
      const perWorkout = new Map<string, { date: string; e1rm: number }>();
      for (const s of sets.filter((x) => x.exerciseId === ex.exerciseId)) {
        const e = estimateOneRepMax(s.weight, s.reps, config.oneRmFormula);
        if (!e) continue;
        const cur = perWorkout.get(s.workoutId);
        if (!cur || e > cur.e1rm) perWorkout.set(s.workoutId, { date: toLocalDate(s.at, tz), e1rm: e });
      }
      if (perWorkout.size) strength.push({ exerciseId: ex.exerciseId, name: ex.name, series: [...perWorkout.values()] });
    }
  }

  const days = workoutRows.map((w) => toLocalDate(w.at, tz));
  const today = toLocalDate(new Date(), tz);
  const inRange = since ? workoutRows.filter((w) => w.at >= since) : workoutRows;
  const totalVolume = weekly.reduce((s, w) => s + w.volumeKg, 0);
  const weeksSpan = Math.max(1, since ? Math.round((Date.now() - since.getTime()) / (7 * 86_400_000)) : weekly.length || 1);
  return {
    range,
    summary: {
      workouts: inRange.length,
      volumeKg: Math.round(totalVolume),
      durationSeconds: weekly.reduce((s, w) => s + w.seconds, 0),
      prs: inRange.reduce((s, w) => s + (w.prs ?? 0), 0),
      perWeek: Math.round((inRange.length / weeksSpan) * 10) / 10,
      streakWeeks: weeklyStreak(days, today),
    },
    weekly,
    muscleSplit: muscle,
    strength,
  };
}

/** Days with a workout in `[from, to]` (local dates) for the training calendar. */
export async function getCalendar(user: SessionUser, from: string, to: string) {
  const tz = user.settings.timezone;
  const { start } = localDayRange(from, tz);
  const { end } = localDayRange(to, tz);
  const rows = await getDb()
    .select({ id: workouts.id, title: workouts.title, at: workouts.startedAt, volume: workouts.volume, seconds: workouts.durationSeconds })
    .from(workouts)
    .where(and(eq(workouts.userId, user.id), eq(workouts.status, "COMPLETED"), gte(workouts.startedAt, start), lt(workouts.startedAt, end)))
    .orderBy(asc(workouts.startedAt))
    .limit(500);
  const byDay: Record<string, Array<{ id: string; title: string; volumeKg: number | null; durationSeconds: number | null }>> = {};
  for (const r of rows) (byDay[toLocalDate(r.at, tz)] ??= []).push({ id: r.id, title: r.title, volumeKg: r.volume, durationSeconds: r.seconds });
  return { from, to, days: byDay, nextDay: addDaysToDateString(to, 1) };
}
