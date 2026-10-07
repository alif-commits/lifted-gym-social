import { z } from "zod";
import { SET_TYPES } from "@/lib/constants";
import { optionalText, uuid } from "./common";

const nn = (schema: z.ZodNumber) => schema.nullish();

export const workoutSetSchema = z.object({
  id: uuid,
  setType: z.enum(SET_TYPES).default("NORMAL"),
  weight: nn(z.number().min(0).max(2000)),
  reps: nn(z.number().int().min(0).max(1000)),
  durationSeconds: nn(z.number().int().min(0).max(86_400)),
  distance: nn(z.number().min(0).max(1000)),
  rpe: nn(z.number().min(1).max(10)),
  rir: nn(z.number().min(0).max(10)),
  completed: z.boolean().default(false),
  notes: optionalText(500),
});
export type WorkoutSetInput = z.infer<typeof workoutSetSchema>;

export const workoutExerciseSchema = z.object({
  id: uuid,
  exerciseId: uuid,
  notes: optionalText(1000),
  restSeconds: nn(z.number().int().min(0).max(3600)),
  sets: z.array(workoutSetSchema).max(60),
});
export type WorkoutExerciseInput = z.infer<typeof workoutExerciseSchema>;

/** Full-state save used by autosave. Server replaces the workout's exercises atomically. */
export const saveWorkoutSchema = z.object({
  title: z.string().trim().min(1).max(120),
  notes: optionalText(2000),
  exercises: z.array(workoutExerciseSchema).max(60),
});
export type SaveWorkoutInput = z.infer<typeof saveWorkoutSchema>;

export const startWorkoutSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  templateId: uuid.optional(),
  repeatWorkoutId: uuid.optional(),
  programDayId: uuid.optional(),
  exerciseIds: z.array(uuid).min(1).max(20).optional(),
});
export type StartWorkoutInput = z.infer<typeof startWorkoutSchema>;

/** Completing may carry a final state snapshot so the last edits are never lost. */
export const completeWorkoutSchema = saveWorkoutSchema.partial();
