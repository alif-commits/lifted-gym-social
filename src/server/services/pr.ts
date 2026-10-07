import { and, eq, inArray, max, ne, sql } from "drizzle-orm";
import { detectRecords, recordCandidates, type CalcExercise, type PriorBests } from "@/lib/calc/workout";
import type { RecordType } from "@/lib/constants";
import { config } from "@/server/config";
import type { DbOrTx } from "@/server/db";
import { personalRecords } from "@/server/db/schema";

export type PrResult = {
  exerciseId: string;
  exerciseName: string;
  recordType: RecordType;
  value: number;
  previousValue: number;
  unit: string;
};

/**
 * PRService: recompute the personal records achieved in a workout.
 * Idempotent — previous records of this workout are replaced, and historical bests exclude it.
 * Returns only genuine improvements (a first-ever value establishes a baseline but is not a PR).
 */
export async function recomputeWorkoutRecords(
  db: DbOrTx,
  args: { userId: string; workoutId: string; achievedAt: Date; exercises: CalcExercise[] },
): Promise<PrResult[]> {
  const { userId, workoutId, achievedAt, exercises } = args;
  await db.delete(personalRecords).where(eq(personalRecords.workoutId, workoutId));

  const exerciseIds = [...new Set(exercises.map((e) => e.exerciseId))];
  if (exerciseIds.length === 0) return [];

  const priorRows = await db
    .select({
      exerciseId: personalRecords.exerciseId,
      recordType: personalRecords.recordType,
      best: max(personalRecords.value),
    })
    .from(personalRecords)
    .where(
      and(
        eq(personalRecords.userId, userId),
        inArray(personalRecords.exerciseId, exerciseIds),
        ne(personalRecords.workoutId, workoutId),
      ),
    )
    .groupBy(personalRecords.exerciseId, personalRecords.recordType);

  const priorByExercise = new Map<string, PriorBests>();
  for (const r of priorRows) {
    if (!r.exerciseId || r.best === null) continue;
    const m = priorByExercise.get(r.exerciseId) ?? {};
    m[r.recordType as RecordType] = Number(r.best);
    priorByExercise.set(r.exerciseId, m);
  }

  // The same exercise can appear twice in a workout; merge candidates by taking the best per record type.
  const merged = new Map<string, { name: string; best: Map<RecordType, { value: number; unit: string }> }>();
  for (const ex of exercises) {
    const entry = merged.get(ex.exerciseId) ?? { name: ex.name, best: new Map() };
    for (const c of recordCandidates(ex, "kg", config.oneRmFormula)) {
      const cur = entry.best.get(c.recordType);
      if (!cur || c.value > cur.value) entry.best.set(c.recordType, { value: c.value, unit: c.unit });
    }
    merged.set(ex.exerciseId, entry);
  }

  const inserts: (typeof personalRecords.$inferInsert)[] = [];
  const improvements: PrResult[] = [];
  for (const [exerciseId, entry] of merged) {
    const candidates = [...entry.best].map(([recordType, v]) => ({ recordType, value: v.value, unit: v.unit }));
    for (const d of detectRecords(candidates, priorByExercise.get(exerciseId) ?? {})) {
      inserts.push({
        userId,
        exerciseId,
        workoutId,
        recordType: d.recordType,
        value: d.value,
        previousValue: d.previousValue,
        unit: d.unit,
        achievedAt,
      });
      if (d.isImprovement && d.previousValue !== null) {
        improvements.push({ exerciseId, exerciseName: entry.name, recordType: d.recordType, value: d.value, previousValue: d.previousValue, unit: d.unit });
      }
    }
  }
  if (inserts.length) await db.insert(personalRecords).values(inserts);
  return improvements;
}

export async function countWorkoutPrs(db: DbOrTx, workoutId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${personalRecords.exerciseId})::int` })
    .from(personalRecords)
    .where(and(eq(personalRecords.workoutId, workoutId), sql`${personalRecords.previousValue} is not null`));
  return row?.n ?? 0;
}
