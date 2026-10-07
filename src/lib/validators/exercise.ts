import { z } from "zod";
import { DIFFICULTIES, EQUIPMENT, EXERCISE_TYPES, MUSCLE_GROUPS, TRACKING_MODES } from "@/lib/constants";
import { optionalText, paginationQuery } from "./common";

export const exerciseInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: optionalText(1000),
  instructions: optionalText(4000),
  primaryMuscleGroup: z.enum(MUSCLE_GROUPS),
  secondaryMuscles: z.array(z.enum(MUSCLE_GROUPS)).max(6).default([]),
  equipment: z.enum(EQUIPMENT).default("OTHER"),
  exerciseType: z.enum(EXERCISE_TYPES).default("STRENGTH"),
  trackingMode: z.enum(TRACKING_MODES).default("WEIGHT_REPS"),
  difficulty: z.enum(DIFFICULTIES).default("INTERMEDIATE"),
});
export type ExerciseInput = z.infer<typeof exerciseInputSchema>;

export const exerciseQuerySchema = paginationQuery.extend({
  q: z.string().trim().max(80).optional(),
  muscle: z.enum(MUSCLE_GROUPS).optional(),
  equipment: z.enum(EQUIPMENT).optional(),
  mine: z.enum(["true", "false"]).optional(),
});
