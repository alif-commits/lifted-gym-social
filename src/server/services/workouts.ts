import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { estimateCaloriesBurned } from "@/lib/calc/calories";
import { computeWorkoutStats, type CalcExercise } from "@/lib/calc/workout";
import type { SaveWorkoutInput, StartWorkoutInput } from "@/lib/validators/workout";
import type { SessionUser } from "@/server/auth/session";
import { getDb, type DbOrTx } from "@/server/db";
import {
  activities,
  exercises,
  personalRecords,
  programDays,
  programExercises,
  programWeeks,
  programs,
  weightRecords,
  workoutExercises,
  workoutSets,
  workoutTemplateExercises,
  workoutTemplates,
  workouts,
} from "@/server/db/schema";
import { ApiError, badRequest, conflict, notFound } from "@/server/http/errors";
import { decodeCursor, encodeCursor, type Page } from "@/server/lib/cursor";
import { snapshotFromExercises } from "./activity-snapshot";
import { assertExercisesAccessible, previousPerformance, type PreviousPerformance } from "./exercises";
import { notify } from "./notifications";
import { countWorkoutPrs, recomputeWorkoutRecords, type PrResult } from "./pr";

type Workout = typeof workouts.$inferSelect;

export type WorkoutSetDto = {
  id: string;
  setNumber: number;
  setType: string;
  weight: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distance: number | null;
  rpe: number | null;
  rir: number | null;
  completed: boolean;
  notes: string | null;
};

export type WorkoutExerciseDto = {
  id: string;
  exerciseId: string;
  orderIndex: number;
  notes: string | null;
  restSeconds: number | null;
  exercise: { id: string; name: string; primaryMuscleGroup: string; equipment: string; trackingMode: string; exerciseType: string };
  sets: WorkoutSetDto[];
  previous?: PreviousPerformance | null;
};

export type WorkoutDto = {
  id: string;
  title: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  durationSeconds: number | null;
  notes: string | null;
  templateId: string | null;
  stats: { exerciseCount: number; setCount: number; repCount: number; volume: number; prCount: number; caloriesBurnedEstimate: number | null } | null;
  exercises: WorkoutExerciseDto[];
  activityId: string | null;
  activityShortId: string | null;
  activityStatus: string | null;
  activityVisibility: string | null;
  source: string;
};

/* --------------------------------- Loading -------------------------------- */

async function loadTree(db: DbOrTx, workoutId: string): Promise<WorkoutExerciseDto[]> {
  const wes = await db
    .select({ we: workoutExercises, ex: exercises })
    .from(workoutExercises)
    .innerJoin(exercises, eq(exercises.id, workoutExercises.exerciseId))
    .where(eq(workoutExercises.workoutId, workoutId))
    .orderBy(asc(workoutExercises.orderIndex));
  if (wes.length === 0) return [];
  const sets = await db
    .select()
    .from(workoutSets)
    .where(inArray(workoutSets.workoutExerciseId, wes.map((w) => w.we.id)))
    .orderBy(asc(workoutSets.setNumber));
  return wes.map(({ we, ex }) => ({
    id: we.id,
    exerciseId: we.exerciseId,
    orderIndex: we.orderIndex,
    notes: we.notes,
    restSeconds: we.restSeconds,
    exercise: {
      id: ex.id,
      name: ex.name,
      primaryMuscleGroup: ex.primaryMuscleGroup,
      equipment: ex.equipment,
      trackingMode: ex.trackingMode,
      exerciseType: ex.exerciseType,
    },
    sets: sets
      .filter((s) => s.workoutExerciseId === we.id)
      .map((s) => ({
        id: s.id,
        setNumber: s.setNumber,
        setType: s.setType,
        weight: s.weight,
        reps: s.reps,
        durationSeconds: s.durationSeconds,
        distance: s.distance,
        rpe: s.rpe,
        rir: s.rir,
        completed: s.completed,
        notes: s.notes,
      })),
  }));
}

export function toCalcExercises(tree: WorkoutExerciseDto[]): CalcExercise[] {
  return tree.map((e) => ({ exerciseId: e.exerciseId, name: e.exercise.name, trackingMode: e.exercise.trackingMode, sets: e.sets }));
}

async function requireWorkout(db: DbOrTx, userId: string, id: string): Promise<Workout> {
  const [w] = await db.select().from(workouts).where(and(eq(workouts.id, id), eq(workouts.userId, userId))).limit(1);
  // 404 (not 403) so the existence of other users' workouts is not revealed.
  if (!w) throw notFound("Workout");
  return w;
}

export async function getWorkout(userId: string, id: string, opts: { withPrevious?: boolean } = {}): Promise<WorkoutDto> {
  const db = getDb();
  const w = await requireWorkout(db, userId, id);
  const tree = await loadTree(db, w.id);
  if (opts.withPrevious && w.status === "ACTIVE") {
    const prev = await previousPerformance(userId, [...new Set(tree.map((t) => t.exerciseId))], w.id);
    for (const t of tree) t.previous = prev.get(t.exerciseId) ?? null;
  }
  const [act] = await db
    .select({ id: activities.id, shortId: activities.shortId, status: activities.status, visibility: activities.visibility })
    .from(activities)
    .where(eq(activities.workoutId, w.id))
    .limit(1);
  return toWorkoutDto(w, tree, act ?? null);
}

function toWorkoutDto(
  w: Workout,
  tree: WorkoutExerciseDto[],
  act: { id: string; shortId: string; status: string; visibility: string } | null,
): WorkoutDto {
  return {
    id: w.id,
    title: w.title,
    status: w.status,
    startedAt: w.startedAt,
    completedAt: w.completedAt,
    durationSeconds: w.durationSeconds,
    notes: w.notes,
    templateId: w.templateId,
    stats:
      w.status === "COMPLETED"
        ? {
            exerciseCount: w.exerciseCount ?? 0,
            setCount: w.setCount ?? 0,
            repCount: w.repCount ?? 0,
            volume: w.volume ?? 0,
            prCount: w.prCount ?? 0,
            caloriesBurnedEstimate: w.caloriesBurnedEstimate,
          }
        : null,
    exercises: tree,
    activityId: act?.id ?? null,
    activityShortId: act?.shortId ?? null,
    activityStatus: act?.status ?? null,
    activityVisibility: act?.visibility ?? null,
    source: w.source,
  };
}

export async function getActiveWorkout(userId: string): Promise<WorkoutDto | null> {
  const [w] = await getDb()
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "ACTIVE")))
    .limit(1);
  return w ? getWorkout(userId, w.id, { withPrevious: true }) : null;
}

/* --------------------------------- Writing -------------------------------- */

type TreeInput = SaveWorkoutInput["exercises"];

/** Replace a workout's exercises/sets atomically. Client-generated ids make retries idempotent. */
async function replaceTree(tx: DbOrTx, userId: string, workoutId: string, input: TreeInput) {
  await assertExercisesAccessible(userId, input.map((e) => e.exerciseId));
  const ids = [...input.map((e) => e.id), ...input.flatMap((e) => e.sets.map((s) => s.id))];
  if (new Set(ids).size !== ids.length) throw badRequest("Duplicate ids in workout payload", "DUPLICATE_IDS");

  // Client-chosen ids must not collide with rows owned by another workout.
  if (input.length) {
    const clash = await tx
      .select({ id: workoutExercises.id })
      .from(workoutExercises)
      .where(and(inArray(workoutExercises.id, input.map((e) => e.id)), sql`${workoutExercises.workoutId} <> ${workoutId}::uuid`))
      .limit(1);
    if (clash.length) throw conflict("Workout item id already in use", "ID_CONFLICT");
    const setIds = input.flatMap((e) => e.sets.map((s) => s.id));
    if (setIds.length) {
      const setClash = await tx
        .select({ id: workoutSets.id })
        .from(workoutSets)
        .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.workoutExerciseId))
        .where(and(inArray(workoutSets.id, setIds), sql`${workoutExercises.workoutId} <> ${workoutId}::uuid`))
        .limit(1);
      if (setClash.length) throw conflict("Workout item id already in use", "ID_CONFLICT");
    }
  }

  await tx.delete(workoutExercises).where(eq(workoutExercises.workoutId, workoutId));
  if (input.length === 0) return;
  await tx.insert(workoutExercises).values(
    input.map((e, i) => ({ id: e.id, workoutId, exerciseId: e.exerciseId, orderIndex: i, notes: e.notes ?? null, restSeconds: e.restSeconds ?? null })),
  );
  const sets = input.flatMap((e) =>
    e.sets.map((s, i) => ({
      id: s.id,
      workoutExerciseId: e.id,
      setNumber: i + 1,
      setType: s.setType,
      weight: s.weight ?? null,
      reps: s.reps ?? null,
      durationSeconds: s.durationSeconds ?? null,
      distance: s.distance ?? null,
      rpe: s.rpe ?? null,
      rir: s.rir ?? null,
      completed: s.completed,
      notes: s.notes ?? null,
    })),
  );
  if (sets.length) await tx.insert(workoutSets).values(sets);
}

function parseRepsTarget(v: string | null | undefined): number | null {
  const m = v?.match(/\d+/);
  return m ? Number(m[0]) : null;
}

type SeedExercise = { exerciseId: string; sets: Array<{ weight: number | null; reps: number | null; durationSeconds?: number | null; distance?: number | null; setType?: string }>; restSeconds?: number | null; notes?: string | null };

async function insertSeed(tx: DbOrTx, workoutId: string, seed: SeedExercise[]) {
  for (const [i, e] of seed.entries()) {
    const [we] = await tx
      .insert(workoutExercises)
      .values({ workoutId, exerciseId: e.exerciseId, orderIndex: i, notes: e.notes ?? null, restSeconds: e.restSeconds ?? null })
      .returning({ id: workoutExercises.id });
    if (e.sets.length) {
      await tx.insert(workoutSets).values(
        e.sets.map((s, j) => ({
          workoutExerciseId: we.id,
          setNumber: j + 1,
          setType: s.setType ?? "NORMAL",
          weight: s.weight,
          reps: s.reps,
          durationSeconds: s.durationSeconds ?? null,
          distance: s.distance ?? null,
          completed: false,
        })),
      );
    }
  }
}

export async function startWorkout(user: SessionUser, input: StartWorkoutInput): Promise<WorkoutDto> {
  const db = getDb();
  const existing = await db.select({ id: workouts.id }).from(workouts).where(and(eq(workouts.userId, user.id), eq(workouts.status, "ACTIVE"))).limit(1);
  if (existing.length) {
    throw new ApiError(409, "ACTIVE_WORKOUT_EXISTS", "You already have a workout in progress", { workoutId: existing[0].id });
  }

  let title = input.title ?? "Workout";
  let templateId: string | null = null;
  let programDayId: string | null = null;
  let seed: SeedExercise[] = [];

  if (input.templateId) {
    const [t] = await db.select().from(workoutTemplates).where(and(eq(workoutTemplates.id, input.templateId), eq(workoutTemplates.userId, user.id), eq(workoutTemplates.active, true)));
    if (!t) throw notFound("Template");
    const items = await db.select().from(workoutTemplateExercises).where(eq(workoutTemplateExercises.templateId, t.id)).orderBy(asc(workoutTemplateExercises.orderIndex));
    title = input.title ?? t.name;
    templateId = t.id;
    seed = items.map((it) => ({
      exerciseId: it.exerciseId,
      restSeconds: it.restSeconds,
      notes: it.notes,
      sets: Array.from({ length: it.targetSets ?? 3 }, () => ({ weight: it.targetWeight, reps: parseRepsTarget(it.targetReps) })),
    }));
  } else if (input.repeatWorkoutId) {
    const prev = await requireWorkout(db, user.id, input.repeatWorkoutId);
    const tree = await loadTree(db, prev.id);
    title = input.title ?? prev.title;
    templateId = prev.templateId;
    seed = tree.map((e) => ({
      exerciseId: e.exerciseId,
      restSeconds: e.restSeconds,
      sets: e.sets.map((s) => ({ weight: s.weight, reps: s.reps, durationSeconds: s.durationSeconds, distance: s.distance, setType: s.setType })),
    }));
  } else if (input.programDayId) {
    const [day] = await db
      .select({ day: programDays })
      .from(programDays)
      .innerJoin(programWeeks, eq(programWeeks.id, programDays.programWeekId))
      .innerJoin(programs, eq(programs.id, programWeeks.programId))
      .where(and(eq(programDays.id, input.programDayId), eq(programs.userId, user.id)));
    if (!day) throw notFound("Program day");
    const items = await db.select().from(programExercises).where(eq(programExercises.programDayId, day.day.id)).orderBy(asc(programExercises.orderIndex));
    title = input.title ?? day.day.name;
    programDayId = day.day.id;
    seed = items.map((it) => ({
      exerciseId: it.exerciseId,
      notes: it.notes,
      sets: Array.from({ length: it.targetSets }, () => ({ weight: it.targetWeight, reps: parseRepsTarget(it.targetReps) })),
    }));
  } else if (input.exerciseIds?.length) {
    await assertExercisesAccessible(user.id, input.exerciseIds);
    seed = input.exerciseIds.map((exerciseId) => ({ exerciseId, sets: [{ weight: null, reps: null }] }));
  } else if (!input.title) {
    const hour = new Date().getHours();
    title = hour < 12 ? "Morning workout" : hour < 18 ? "Afternoon workout" : "Evening workout";
  }

  const workoutId = await db.transaction(async (tx) => {
    const [w] = await tx.insert(workouts).values({ userId: user.id, title, templateId, programDayId }).returning({ id: workouts.id });
    await insertSeed(tx, w.id, seed);
    return w.id;
  });
  return getWorkout(user.id, workoutId, { withPrevious: true });
}

export async function saveWorkout(user: SessionUser, id: string, input: SaveWorkoutInput): Promise<{ savedAt: Date; workout?: WorkoutDto }> {
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const [w] = await tx.select().from(workouts).where(and(eq(workouts.id, id), eq(workouts.userId, user.id))).for("update");
    if (!w) throw notFound("Workout");
    await tx.update(workouts).set({ title: input.title, notes: input.notes ?? null }).where(eq(workouts.id, id));
    await replaceTree(tx, user.id, id, input.exercises);
    if (w.status === "COMPLETED") await finalizeStats(tx, user, w, { notify: false });
    return { completed: w.status === "COMPLETED" };
  });
  return { savedAt: new Date(), workout: result.completed ? await getWorkout(user.id, id) : undefined };
}

async function latestWeightKg(tx: DbOrTx, userId: string): Promise<number | null> {
  const [r] = await tx
    .select({ w: weightRecords.weight, unit: weightRecords.unit })
    .from(weightRecords)
    .where(eq(weightRecords.userId, userId))
    .orderBy(desc(weightRecords.recordedAt))
    .limit(1);
  return r ? r.w : null;
}

/** Recompute authoritative stats and personal records for a completed workout. */
async function finalizeStats(tx: DbOrTx, user: SessionUser, w: Workout, opts: { notify: boolean }): Promise<{ prs: PrResult[]; setCount: number }> {
  const tree = await loadTree(tx, w.id);
  const calc = toCalcExercises(tree);
  const stats = computeWorkoutStats(calc);
  const completedAt = w.completedAt ?? new Date();
  const duration = w.durationSeconds ?? Math.max(1, Math.round((completedAt.getTime() - w.startedAt.getTime()) / 1000));
  const calories = estimateCaloriesBurned(await latestWeightKg(tx, user.id), duration);

  const prs = await recomputeWorkoutRecords(tx, { userId: user.id, workoutId: w.id, achievedAt: completedAt, exercises: calc });
  const prCount = await countWorkoutPrs(tx, w.id);

  await tx
    .update(workouts)
    .set({
      exerciseCount: stats.exerciseCount,
      setCount: stats.setCount,
      repCount: stats.repCount,
      volume: stats.volume,
      prCount,
      caloriesBurnedEstimate: calories,
    })
    .where(eq(workouts.id, w.id));

  // Keep the published activity's snapshot consistent with the workout.
  const snap = snapshotFromExercises(calc);
  await tx
    .update(activities)
    .set({
      exerciseCount: snap.exerciseCount,
      setCount: snap.setCount,
      repCount: snap.repCount,
      volume: snap.volume,
      prCount,
      caloriesBurnedEstimate: calories,
      summary: snap.summary,
    })
    .where(eq(activities.workoutId, w.id));

  if (opts.notify) {
    for (const pr of prs) {
      await notify(
        {
          userId: user.id,
          type: "PR",
          title: `New PR on ${pr.exerciseName}`,
          message: `${pr.recordType.replace(/_/g, " ").toLowerCase()}: ${pr.value} ${pr.unit} (was ${pr.previousValue})`,
          payload: { workoutId: w.id, exerciseId: pr.exerciseId, recordType: pr.recordType },
          dedupeKey: `pr:${w.id}:${pr.exerciseId}:${pr.recordType}`,
        },
        tx,
      );
    }
  }
  return { prs, setCount: stats.setCount };
}

export async function completeWorkout(user: SessionUser, id: string, input: Partial<SaveWorkoutInput> | undefined) {
  const db = getDb();
  const { prs, already } = await db.transaction(async (tx) => {
    const [w] = await tx.select().from(workouts).where(and(eq(workouts.id, id), eq(workouts.userId, user.id))).for("update");
    if (!w) throw notFound("Workout");
    // Idempotent: completing twice returns the existing result.
    if (w.status === "COMPLETED") return { prs: [] as PrResult[], already: true };

    if (input?.exercises) await replaceTree(tx, user.id, id, input.exercises);
    if (input?.title || input?.notes !== undefined) {
      await tx
        .update(workouts)
        .set({ ...(input.title ? { title: input.title } : {}), ...(input.notes !== undefined ? { notes: input.notes ?? null } : {}) })
        .where(eq(workouts.id, id));
    }

    const tree = await loadTree(tx, id);
    if (computeWorkoutStats(toCalcExercises(tree)).setCount === 0) {
      throw new ApiError(422, "NO_COMPLETED_SETS", "Complete at least one set before finishing your workout");
    }

    const completedAt = new Date();
    const durationSeconds = Math.min(24 * 3600, Math.max(1, Math.round((completedAt.getTime() - w.startedAt.getTime()) / 1000)));
    await tx.update(workouts).set({ status: "COMPLETED", completedAt, durationSeconds }).where(eq(workouts.id, id));
    const fresh = { ...w, status: "COMPLETED", completedAt, durationSeconds };
    const res = await finalizeStats(tx, user, fresh, { notify: true });
    return { prs: res.prs, already: false };
  });
  const workout = await getWorkout(user.id, id);
  return { workout, prs, alreadyCompleted: already };
}

export async function discardWorkout(userId: string, id: string) {
  const w = await requireWorkout(getDb(), userId, id);
  if (w.status !== "ACTIVE") throw conflict("Only an in-progress workout can be discarded", "NOT_ACTIVE");
  await getDb().delete(workouts).where(eq(workouts.id, id));
}

export async function deleteWorkout(userId: string, id: string) {
  await requireWorkout(getDb(), userId, id);
  // Activity.workout_id is ON DELETE SET NULL: the social activity survives, the raw workout is removed.
  await getDb().delete(workouts).where(eq(workouts.id, id));
}

export async function updateWorkoutMeta(userId: string, id: string, patch: { title?: string; notes?: string | null }) {
  await requireWorkout(getDb(), userId, id);
  await getDb().update(workouts).set(patch).where(eq(workouts.id, id));
}

/* --------------------------------- History -------------------------------- */

export type WorkoutListItem = {
  id: string;
  title: string;
  startedAt: Date;
  durationSeconds: number | null;
  exerciseCount: number;
  setCount: number;
  volume: number;
  prCount: number;
  activityId: string | null;
  activityStatus: string | null;
  source: string;
};

export async function listWorkouts(userId: string, limit: number, cursor?: string): Promise<Page<WorkoutListItem>> {
  const c = decodeCursor<{ t: string; id: string }>(cursor);
  const rows = await getDb()
    .select({ w: workouts, activityId: activities.id, activityStatus: activities.status })
    .from(workouts)
    .leftJoin(activities, eq(activities.workoutId, workouts.id))
    .where(
      and(
        eq(workouts.userId, userId),
        eq(workouts.status, "COMPLETED"),
        c ? sql`(${workouts.startedAt}, ${workouts.id}) < (${c.t}::timestamptz, ${c.id}::uuid)` : undefined,
      ),
    )
    .orderBy(desc(workouts.startedAt), desc(workouts.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return {
    items: page.map(({ w, activityId, activityStatus }) => ({
      id: w.id,
      title: w.title,
      startedAt: w.startedAt,
      durationSeconds: w.durationSeconds,
      exerciseCount: w.exerciseCount ?? 0,
      setCount: w.setCount ?? 0,
      volume: w.volume ?? 0,
      prCount: w.prCount ?? 0,
      activityId,
      activityStatus,
      source: w.source,
    })),
    next_cursor: rows.length > limit ? encodeCursor({ t: page[page.length - 1].w.startedAt.toISOString(), id: page[page.length - 1].w.id }) : null,
  };
}

export async function listWorkoutPrs(userId: string, workoutId: string) {
  await requireWorkout(getDb(), userId, workoutId);
  const rows = await getDb()
    .select({ pr: personalRecords, name: exercises.name })
    .from(personalRecords)
    .innerJoin(exercises, eq(exercises.id, personalRecords.exerciseId))
    .where(and(eq(personalRecords.workoutId, workoutId), sql`${personalRecords.previousValue} is not null`));
  return rows.map(({ pr, name }) => ({ exerciseId: pr.exerciseId, exerciseName: name, recordType: pr.recordType, value: pr.value, previousValue: pr.previousValue, unit: pr.unit }));
}


