import { bestSetSummary, computeWorkoutStats, type CalcExercise } from "@/lib/calc/workout";
import type { ActivitySummaryItem } from "@/server/db/schema";

export type SnapshotExercise = CalcExercise;

/** Denormalised read model of a workout, stored on the activity so feeds never load raw workouts. */
export function snapshotFromExercises(exercises: SnapshotExercise[]) {
  const stats = computeWorkoutStats(exercises);
  const summary: ActivitySummaryItem[] = [];
  for (const ex of exercises) {
    const best = bestSetSummary(ex);
    if (!best) continue;
    summary.push({
      exerciseId: ex.exerciseId,
      name: ex.name,
      sets: ex.sets.filter((s) => s.completed && s.setType !== "WARMUP").length,
      best,
    });
  }
  return { ...stats, summary };
}
