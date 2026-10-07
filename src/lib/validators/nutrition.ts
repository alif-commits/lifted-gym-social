import { z } from "zod";
import { ACTIVITY_LEVELS, FOOD_UNITS, NUTRITION_GOALS, SEX_OPTIONS } from "@/lib/constants";
import { dateString, isoDateTime, optionalText, paginationQuery, uuid } from "./common";

const macro = z.number().min(0).max(100_000);

export const calorieCalcSchema = z.object({
  age: z.number().int().min(13).max(100),
  sex: z.enum(SEX_OPTIONS),
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(30).max(300),
  activityLevel: z.enum(ACTIVITY_LEVELS),
  goal: z.enum(NUTRITION_GOALS),
  adjustmentKcal: z.number().min(0).max(1500).optional(),
  save: z.boolean().default(false),
});

export const calorieGoalSchema = z.object({
  calorieTarget: z.number().min(800).max(10_000),
  proteinTargetG: macro,
  carbsTargetG: macro,
  fatTargetG: macro,
  fiberTargetG: macro.nullish(),
  source: z.enum(["CALCULATOR", "MANUAL"]).default("MANUAL"),
});

export const foodInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  brand: z.string().trim().max(120).nullish(),
  servingSize: z.number().positive().max(10_000).default(100),
  servingUnit: z.enum(FOOD_UNITS).default("g"),
  calories: macro,
  proteinG: macro,
  carbsG: macro,
  fatG: macro,
  fiberG: macro.nullish(),
  barcode: z.string().trim().max(64).nullish(),
});

export const foodQuerySchema = paginationQuery.extend({ q: z.string().trim().min(1).max(80) });

export const entryInputSchema = z.object({
  mealName: z.string().trim().min(1).max(60).default("Snack"),
  consumedAt: isoDateTime.optional(),
  foodItemId: uuid.nullish(),
  source: z.enum(["SEARCH", "MANUAL"]).default("MANUAL"),
  foodName: z.string().trim().min(1).max(160),
  quantity: z.number().positive().max(100_000),
  unit: z.enum(FOOD_UNITS),
  calories: macro,
  proteinG: macro,
  carbsG: macro,
  fatG: macro,
  fiberG: macro.nullish(),
  notes: optionalText(500),
});
export type EntryInput = z.infer<typeof entryInputSchema>;

export const entryUpdateSchema = entryInputSchema.partial();

export const nutritionDayQuery = z.object({ date: dateString.optional() });
export const nutritionRangeQuery = z.object({ from: dateString, to: dateString });

export const shareCardSchema = z.object({
  date: dateString,
  metrics: z.array(z.enum(["calories", "proteinG", "carbsG", "fatG", "fiberG"])).min(1),
});
