import { z } from "zod";
import { GOAL_TYPES, MEASUREMENT_TYPES, PROGRESS_PHOTO_TYPES } from "@/lib/constants";
import { dateString, isoDateTime, optionalText, uuid } from "./common";

export const weightInputSchema = z.object({
  weightKg: z.number().min(20).max(500),
  recordedAt: isoDateTime.optional(),
  notes: optionalText(500),
});

export const measurementInputSchema = z.object({
  measurementType: z.enum(MEASUREMENT_TYPES),
  valueCm: z.number().min(1).max(400),
  recordedAt: isoDateTime.optional(),
  notes: optionalText(500),
});

export const progressPhotoMetaSchema = z.object({
  photoType: z.enum(PROGRESS_PHOTO_TYPES),
  recordedAt: isoDateTime.optional(),
  notes: optionalText(500),
});

export const goalInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  goalType: z.enum(GOAL_TYPES),
  exerciseId: uuid.nullish(),
  targetValue: z.number().min(0).max(100_000).nullish(),
  targetUnit: z.string().trim().max(16).nullish(),
  startValue: z.number().min(0).max(100_000).nullish(),
  targetDate: dateString.nullish(),
  notes: optionalText(500),
});
export const goalUpdateSchema = goalInputSchema.partial().extend({
  status: z.enum(["ACTIVE", "ACHIEVED", "ABANDONED"]).optional(),
});

export const rangeQuerySchema = z.object({
  range: z.enum(["30d", "90d", "180d", "365d", "all"]).default("90d"),
});
