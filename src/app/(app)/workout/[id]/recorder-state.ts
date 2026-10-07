import { useCallback, useEffect, useRef, useState } from "react";
import { put } from "@/lib/client/api";
import type { Workout } from "@/lib/client/types";

export type SetState = {
  id: string;
  setType: string;
  weight: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distance: number | null;
  rpe: number | null;
  rir: number | null;
  completed: boolean;
};
export type ExerciseState = {
  id: string;
  exerciseId: string;
  exercise: Workout["exercises"][number]["exercise"];
  notes: string | null;
  restSeconds: number | null;
  sets: SetState[];
  previous: Workout["exercises"][number]["previous"];
};
export type RecorderState = { title: string; notes: string; exercises: ExerciseState[] };

export const newId = () => crypto.randomUUID();

export function blankSet(from?: SetState): SetState {
  return { id: newId(), setType: "NORMAL", weight: from?.weight ?? null, reps: from?.reps ?? null, durationSeconds: from?.durationSeconds ?? null, distance: from?.distance ?? null, rpe: null, rir: null, completed: false };
}

export function fromWorkout(w: Workout): RecorderState {
  return {
    title: w.title,
    notes: w.notes ?? "",
    exercises: w.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      exercise: e.exercise,
      notes: e.notes,
      restSeconds: e.restSeconds,
      previous: e.previous ?? null,
      sets: e.sets.map((s) => ({ id: s.id, setType: s.setType, weight: s.weight, reps: s.reps, durationSeconds: s.durationSeconds, distance: s.distance, rpe: s.rpe, rir: s.rir, completed: s.completed })),
    })),
  };
}

/** Wire format for PUT /workouts/:id and POST /workouts/:id/complete. */
export function toPayload(s: RecorderState) {
  return {
    title: s.title.trim() || "Workout",
    notes: s.notes.trim() || null,
    exercises: s.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      notes: e.notes?.trim() || null,
      restSeconds: e.restSeconds,
      sets: e.sets.map((x) => ({ id: x.id, setType: x.setType, weight: x.weight, reps: x.reps, durationSeconds: x.durationSeconds, distance: x.distance, rpe: x.rpe, rir: x.rir, completed: x.completed })),
    })),
  };
}

/** Wall-clock helper kept outside components so render purity checks only see event-time use. */
export const nowMs = () => Date.now();

export const draftKey = (id: string) => `lifted-workout-draft:${id}`;

export type SaveStatus = "saved" | "dirty" | "saving" | "error";

/**
 * Debounced full-state autosave. Every edit is mirrored to localStorage first so a crash,
 * dead battery or lost connection never loses sets; the server write is idempotent (client ids).
 */
export function useAutosave(workoutId: string, state: RecorderState | null, serverState: RecorderState | null) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const version = useRef(0);
  const latest = useRef<RecorderState | null>(null);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef<() => void>(() => {});

  const flush = useCallback(async () => {
    const snapshot = latest.current;
    if (!snapshot || inFlight.current) return;
    const v = version.current;
    inFlight.current = true;
    setStatus("saving");
    try {
      await put(`/workouts/${workoutId}`, toPayload(snapshot));
      if (version.current === v) {
        setStatus("saved");
        localStorage.removeItem(draftKey(workoutId));
      } else setStatus("dirty");
    } catch {
      setStatus("error");
      timer.current = setTimeout(() => retry.current(), 5000);
    } finally {
      inFlight.current = false;
      if (version.current !== v && timer.current === null) timer.current = setTimeout(() => retry.current(), 800);
    }
  }, [workoutId]);

  useEffect(() => {
    retry.current = flush;
  }, [flush]);

  // React to edits (skip the pristine server snapshot).
  useEffect(() => {
    if (!state || state === serverState) return;
    latest.current = state;
    version.current++;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors edits into the autosave pipeline, an external system
    setStatus("dirty");
    try {
      localStorage.setItem(draftKey(workoutId), JSON.stringify(state));
    } catch {
      /* storage full or unavailable: server autosave still runs */
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      flush();
    }, 900);
  }, [state, serverState, workoutId, flush]);

  // Retry as soon as connectivity returns; flush when the tab is hidden.
  useEffect(() => {
    const retry = () => {
      if (latest.current && version.current > 0) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        flush();
      }
    };
    const onHide = () => document.visibilityState === "hidden" && retry();
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onHide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  const saveNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    while (inFlight.current) await new Promise((r) => setTimeout(r, 50));
    if (version.current > 0) await flush();
  }, [flush]);

  return { status, saveNow };
}
