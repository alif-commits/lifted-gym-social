import type { OneRepMaxFormula, RecordType, SetType, TrackingMode } from "@/lib/constants";
import { estimateOneRepMax } from "./one-rep-max";

export type CalcSet = {
  setType: SetType | string;
  weight: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distance: number | null;
  completed: boolean;
};

export type CalcExercise = {
  exerciseId: string;
  name: string;
  trackingMode: TrackingMode | string;
  sets: CalcSet[];
};

/** Sets that count toward statistics: completed, non-warmup. */
export function workingSets(sets: CalcSet[]): CalcSet[] {
  return sets.filter((s) => s.completed && s.setType !== "WARMUP");
}

export function setVolume(s: CalcSet): number {
  return s.weight && s.reps ? s.weight * s.reps : 0;
}

export type WorkoutStats = {
  exerciseCount: number;
  setCount: number;
  repCount: number;
  volume: number;
};

export function computeWorkoutStats(exercises: CalcExercise[]): WorkoutStats {
  let setCount = 0;
  let repCount = 0;
  let volume = 0;
  let exerciseCount = 0;
  for (const ex of exercises) {
    const sets = workingSets(ex.sets);
    if (sets.length === 0) continue;
    exerciseCount += 1;
    for (const s of sets) {
      setCount += 1;
      repCount += s.reps ?? 0;
      volume += setVolume(s);
    }
  }
  return { exerciseCount, setCount, repCount, volume: Math.round(volume * 10) / 10 };
}

/* ------------------------------ Personal records --------------------------- */

export type RecordCandidate = { recordType: RecordType; value: number; unit: string };

/**
 * All record values achieved by a single exercise within one workout.
 * Which record types are relevant depends on the exercise tracking mode.
 */
export function recordCandidates(
  ex: Pick<CalcExercise, "trackingMode" | "sets">,
  weightUnit: string,
  formula?: OneRepMaxFormula,
): RecordCandidate[] {
  const sets = workingSets(ex.sets);
  if (sets.length === 0) return [];
  const out: RecordCandidate[] = [];
  const max = (values: number[]) => (values.length ? Math.max(...values) : null);

  switch (ex.trackingMode) {
    case "WEIGHT_REPS": {
      const w = max(sets.filter((s) => s.weight && s.reps).map((s) => s.weight!));
      if (w) out.push({ recordType: "MAX_WEIGHT", value: w, unit: weightUnit });
      const oneRm = max(
        sets.map((s) => estimateOneRepMax(s.weight, s.reps, formula)).filter((v): v is number => v !== null),
      );
      if (oneRm) out.push({ recordType: "ESTIMATED_1RM", value: oneRm, unit: weightUnit });
      const vol = sets.reduce((a, s) => a + setVolume(s), 0);
      if (vol > 0) out.push({ recordType: "EXERCISE_VOLUME", value: Math.round(vol * 10) / 10, unit: weightUnit });
      break;
    }
    case "BODYWEIGHT_REPS": {
      const reps = max(sets.filter((s) => s.reps).map((s) => s.reps!));
      if (reps) out.push({ recordType: "MAX_REPS", value: reps, unit: "reps" });
      const w = max(sets.filter((s) => s.weight && s.reps).map((s) => s.weight!));
      if (w) out.push({ recordType: "MAX_WEIGHT", value: w, unit: weightUnit });
      break;
    }
    case "DURATION": {
      const d = max(sets.filter((s) => s.durationSeconds).map((s) => s.durationSeconds!));
      if (d) out.push({ recordType: "MAX_DURATION", value: d, unit: "s" });
      break;
    }
    case "DISTANCE_DURATION": {
      const dist = max(sets.filter((s) => s.distance).map((s) => s.distance!));
      if (dist) out.push({ recordType: "MAX_DISTANCE", value: dist, unit: "km" });
      const d = max(sets.filter((s) => s.durationSeconds).map((s) => s.durationSeconds!));
      if (d) out.push({ recordType: "MAX_DURATION", value: d, unit: "s" });
      break;
    }
  }
  return out;
}

export type PriorBests = Partial<Record<RecordType, number>>;
export type DetectedRecord = RecordCandidate & { previousValue: number | null; isImprovement: boolean };

/**
 * Compare candidates with historical bests. A record is always stored (to establish a baseline)
 * but only flagged as an improvement when it beats an existing previous value.
 */
export function detectRecords(candidates: RecordCandidate[], prior: PriorBests): DetectedRecord[] {
  const out: DetectedRecord[] = [];
  for (const c of candidates) {
    const previous = prior[c.recordType];
    if (previous === undefined) {
      out.push({ ...c, previousValue: null, isImprovement: false });
    } else if (c.value > previous) {
      out.push({ ...c, previousValue: previous, isImprovement: true });
    }
  }
  return out;
}

/** The set that best represents an exercise in a feed card (highest volume / reps / duration / distance). */
export function bestSetSummary(ex: Pick<CalcExercise, "trackingMode" | "sets">) {
  const sets = workingSets(ex.sets);
  if (sets.length === 0) return null;
  const score = (s: CalcSet) => {
    if (ex.trackingMode === "DISTANCE_DURATION") return (s.distance ?? 0) * 1e6 + (s.durationSeconds ?? 0);
    if (ex.trackingMode === "DURATION") return s.durationSeconds ?? 0;
    const v = setVolume(s);
    return v > 0 ? v : s.reps ?? 0;
  };
  const best = sets.reduce((a, b) => (score(b) > score(a) ? b : a));
  return {
    weight: best.weight,
    reps: best.reps,
    durationSeconds: best.durationSeconds,
    distance: best.distance,
  };
}
