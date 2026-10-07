import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { exercises, workoutExercises, workoutSets, workouts, personalRecords } from "@/server/db/schema";
import { conflict, forbidden, notFound } from "@/server/http/errors";
import { decodeCursor, encodeCursor, type Page } from "@/server/lib/cursor";
import { estimateOneRepMax } from "@/lib/calc/one-rep-max";
import { config } from "@/server/config";
import type { ExerciseInput } from "@/lib/validators/exercise";

export type ExerciseDto = {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  primaryMuscleGroup: string;
  secondaryMuscles: string[];
  equipment: string;
  exerciseType: string;
  trackingMode: string;
  difficulty: string;
  isGlobal: boolean;
  isMine: boolean;
};

export function toExerciseDto(e: typeof exercises.$inferSelect, viewerId: string | null): ExerciseDto {
  return {
    id: e.id,
    name: e.name,
    description: e.description,
    instructions: e.instructions,
    primaryMuscleGroup: e.primaryMuscleGroup,
    secondaryMuscles: e.secondaryMuscles ?? [],
    equipment: e.equipment,
    exerciseType: e.exerciseType,
    trackingMode: e.trackingMode,
    difficulty: e.difficulty,
    isGlobal: e.isGlobal,
    isMine: e.ownerUserId !== null && e.ownerUserId === viewerId,
  };
}

/** Visible to a user: global exercises plus their own custom ones. */
const accessible = (userId: string): SQL => and(eq(exercises.active, true), or(eq(exercises.isGlobal, true), eq(exercises.ownerUserId, userId)))!;

export async function listExercises(
  user: SessionUser,
  q: { q?: string; muscle?: string; equipment?: string; mine?: string; limit: number; cursor?: string },
): Promise<Page<ExerciseDto>> {
  const c = decodeCursor<{ n: string; id: string }>(q.cursor);
  const where = and(
    accessible(user.id),
    q.q ? ilike(exercises.name, `%${q.q.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
    q.muscle ? eq(exercises.primaryMuscleGroup, q.muscle) : undefined,
    q.equipment ? eq(exercises.equipment, q.equipment) : undefined,
    q.mine === "true" ? eq(exercises.ownerUserId, user.id) : undefined,
    c ? sql`(${exercises.name}, ${exercises.id}) > (${c.n}, ${c.id}::uuid)` : undefined,
  );
  const rows = await getDb()
    .select()
    .from(exercises)
    .where(where)
    .orderBy(asc(exercises.name), asc(exercises.id))
    .limit(q.limit + 1);
  const page = rows.slice(0, q.limit);
  return {
    items: page.map((e) => toExerciseDto(e, user.id)),
    next_cursor: rows.length > q.limit ? encodeCursor({ n: page[page.length - 1].name, id: page[page.length - 1].id }) : null,
  };
}

export async function getExercise(user: SessionUser, id: string) {
  const [e] = await getDb().select().from(exercises).where(and(eq(exercises.id, id), accessible(user.id))).limit(1);
  if (!e) throw notFound("Exercise");
  return e;
}

export async function createExercise(user: SessionUser, input: ExerciseInput) {
  const [e] = await getDb()
    .insert(exercises)
    .values({ ...input, ownerUserId: user.id, isGlobal: false })
    .returning();
  return toExerciseDto(e, user.id);
}

async function requireOwned(user: SessionUser, id: string) {
  const [e] = await getDb().select().from(exercises).where(eq(exercises.id, id)).limit(1);
  if (!e || (!e.isGlobal && e.ownerUserId !== user.id)) throw notFound("Exercise");
  if (e.isGlobal || e.ownerUserId !== user.id) throw forbidden("Global exercises can't be modified");
  return e;
}

export async function updateExercise(user: SessionUser, id: string, input: ExerciseInput) {
  await requireOwned(user, id);
  const [e] = await getDb().update(exercises).set(input).where(eq(exercises.id, id)).returning();
  return toExerciseDto(e, user.id);
}

export async function deleteExercise(user: SessionUser, id: string) {
  await requireOwned(user, id);
  const db = getDb();
  const used = await db.select({ id: workoutExercises.id }).from(workoutExercises).where(eq(workoutExercises.exerciseId, id)).limit(1);
  if (used.length) {
    // Keep historical workouts intact: archive instead of deleting.
    await db.update(exercises).set({ active: false }).where(eq(exercises.id, id));
    return;
  }
  await db.delete(exercises).where(eq(exercises.id, id));
}

/** Throws if any id is not usable by the user. */
export async function assertExercisesAccessible(userId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map<string, typeof exercises.$inferSelect>();
  const rows = await getDb().select().from(exercises).where(and(inArray(exercises.id, unique), or(eq(exercises.isGlobal, true), eq(exercises.ownerUserId, userId))));
  if (rows.length !== unique.length) throw conflict("One or more exercises are unavailable", "EXERCISE_UNAVAILABLE");
  return new Map(rows.map((r) => [r.id, r]));
}

export type PreviousSet = {
  setNumber: number;
  setType: string;
  weight: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distance: number | null;
};
export type PreviousPerformance = { workoutId: string; date: Date; sets: PreviousSet[] };

/** Most recent completed performance for each exercise (for "previous" hints while logging). */
export async function previousPerformance(userId: string, exerciseIds: string[], excludeWorkoutId?: string) {
  const out = new Map<string, PreviousPerformance>();
  if (exerciseIds.length === 0) return out;
  const db = getDb();
  const latest = await db
    .selectDistinctOn([workoutExercises.exerciseId], {
      exerciseId: workoutExercises.exerciseId,
      weId: workoutExercises.id,
      workoutId: workouts.id,
      at: workouts.completedAt,
    })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(
      and(
        eq(workouts.userId, userId),
        eq(workouts.status, "COMPLETED"),
        inArray(workoutExercises.exerciseId, exerciseIds),
        excludeWorkoutId ? sql`${workouts.id} <> ${excludeWorkoutId}::uuid` : undefined,
        sql`exists (select 1 from workout_sets s where s.workout_exercise_id = ${workoutExercises.id} and s.completed = true)`,
      ),
    )
    .orderBy(workoutExercises.exerciseId, desc(workouts.completedAt));
  if (latest.length === 0) return out;
  const sets = await db
    .select()
    .from(workoutSets)
    .where(and(inArray(workoutSets.workoutExerciseId, latest.map((l) => l.weId)), eq(workoutSets.completed, true)))
    .orderBy(asc(workoutSets.setNumber));
  for (const l of latest) {
    out.set(l.exerciseId, {
      workoutId: l.workoutId,
      date: l.at!,
      sets: sets
        .filter((s) => s.workoutExerciseId === l.weId)
        .map((s) => ({ setNumber: s.setNumber, setType: s.setType, weight: s.weight, reps: s.reps, durationSeconds: s.durationSeconds, distance: s.distance })),
    });
  }
  return out;
}

/** Progression + records for an exercise detail page. */
export async function exerciseHistory(user: SessionUser, exerciseId: string) {
  const ex = await getExercise(user, exerciseId);
  const db = getDb();
  const rows = await db
    .select({
      workoutId: workouts.id,
      title: workouts.title,
      at: workouts.completedAt,
      setNumber: workoutSets.setNumber,
      setType: workoutSets.setType,
      weight: workoutSets.weight,
      reps: workoutSets.reps,
      durationSeconds: workoutSets.durationSeconds,
      distance: workoutSets.distance,
    })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workouts.userId, user.id), eq(workouts.status, "COMPLETED"), eq(workoutExercises.exerciseId, exerciseId), eq(workoutSets.completed, true)))
    .orderBy(desc(workouts.completedAt), asc(workoutSets.setNumber))
    .limit(600);

  const byWorkout = new Map<string, { workoutId: string; title: string; date: Date; sets: typeof rows; bestOneRm: number | null; bestWeight: number | null; volume: number }>();
  for (const r of rows) {
    const g = byWorkout.get(r.workoutId) ?? { workoutId: r.workoutId, title: r.title, date: r.at!, sets: [], bestOneRm: null, bestWeight: null, volume: 0 };
    g.sets.push(r);
    if (r.setType !== "WARMUP") {
      const e1 = estimateOneRepMax(r.weight, r.reps, config.oneRmFormula);
      if (e1 && (g.bestOneRm === null || e1 > g.bestOneRm)) g.bestOneRm = e1;
      if (r.weight && (g.bestWeight === null || r.weight > g.bestWeight)) g.bestWeight = r.weight;
      g.volume += (r.weight ?? 0) * (r.reps ?? 0);
    }
    byWorkout.set(r.workoutId, g);
  }
  const sessions = [...byWorkout.values()].slice(0, 30);

  const records = await db
    .select()
    .from(personalRecords)
    .where(and(eq(personalRecords.userId, user.id), eq(personalRecords.exerciseId, exerciseId)))
    .orderBy(desc(personalRecords.value));
  const bestByType = new Map<string, (typeof records)[number]>();
  for (const r of records) if (!bestByType.has(r.recordType)) bestByType.set(r.recordType, r);

  return {
    exercise: toExerciseDto(ex, user.id),
    sessions: sessions.map((s) => ({
      workoutId: s.workoutId,
      title: s.title,
      date: s.date,
      bestOneRm: s.bestOneRm,
      bestWeight: s.bestWeight,
      volume: Math.round(s.volume * 10) / 10,
      sets: s.sets.map((x) => ({ setNumber: x.setNumber, setType: x.setType, weight: x.weight, reps: x.reps, durationSeconds: x.durationSeconds, distance: x.distance })),
    })),
    records: [...bestByType.values()].map((r) => ({ recordType: r.recordType, value: r.value, unit: r.unit, achievedAt: r.achievedAt, workoutId: r.workoutId })),
  };
}


