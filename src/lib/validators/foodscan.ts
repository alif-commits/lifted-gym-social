import { z } from "zod";
import { FOOD_UNITS } from "@/lib/constants";
import { isoDateTime, optionalText, uuid } from "./common";

const macro = z.number().min(0).max(100_000);

export const scanItemUpdateSchema = z
  .object({
    recognizedName: z.string().trim().min(1).max(160),
    matchedFoodId: uuid.nullable(),
    estimatedQuantity: z.number().positive().max(100_000),
    estimatedUnit: z.enum(FOOD_UNITS),
    calories: macro,
    proteinG: macro,
    carbsG: macro,
    fatG: macro,
    fiberG: macro.nullable(),
  })
  .partial();

export const scanItemCreateSchema = z.object({
  recognizedName: z.string().trim().min(1).max(160),
  matchedFoodId: uuid.nullish(),
  estimatedQuantity: z.number().positive().max(100_000),
  estimatedUnit: z.enum(FOOD_UNITS),
  calories: macro,
  proteinG: macro,
  carbsG: macro,
  fatG: macro,
  fiberG: macro.nullish(),
});

export const confirmScanSchema = z.object({
  mealName: z.string().trim().min(1).max(60).default("Snack"),
  consumedAt: isoDateTime.optional(),
  notes: optionalText(500),
});

/** Structured output we require from the vision model. */
export const visionOutputSchema = z.object({
  isFood: z.boolean().describe("False when the image does not contain food or drink"),
  items: z
    .array(
      z.object({
        name: z.string().describe("Common, generic food name, e.g. 'grilled chicken breast'"),
        estimatedQuantity: z.number().positive().describe("Estimated amount eaten/served"),
        unit: z.enum(["g", "ml", "piece", "slice", "cup", "serving"]).describe("Prefer grams for solids"),
        confidence: z.number().min(0).max(1).describe("How sure you are the food was identified correctly"),
        portionConfidence: z.number().min(0).max(1).describe("How sure you are about the portion size"),
      }),
    )
    .max(12),
});
export type VisionOutput = z.infer<typeof visionOutputSchema>;
