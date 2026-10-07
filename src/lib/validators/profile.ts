import { z } from "zod";
import {
  ACTIVITY_LEVELS,
  DATA_VISIBILITIES,
  FITNESS_GOALS,
  SEX_OPTIONS,
  TRAINING_EXPERIENCE,
  VISIBILITIES,
} from "@/lib/constants";
import { isValidTimezone } from "@/lib/tz";
import { dateString } from "./common";
import { usernameSchema } from "./auth";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    username: usernameSchema,
    bio: nullableText(300),
    dateOfBirth: dateString.nullish(),
    sex: z.enum(SEX_OPTIONS).nullish(),
    heightCm: z.number().min(50).max(272).nullish(),
    activityLevel: z.enum(ACTIVITY_LEVELS).nullish(),
    trainingExperience: z.enum(TRAINING_EXPERIENCE).nullish(),
    fitnessGoal: z.enum(FITNESS_GOALS).nullish(),
  })
  .partial();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const statsVisibilitySchema = z
  .object({
    activities: z.boolean(),
    trainingTime: z.boolean(),
    totalVolume: z.boolean(),
    prCount: z.boolean(),
    streak: z.boolean(),
    achievements: z.boolean(),
  })
  .partial();

export const updateSettingsSchema = z
  .object({
    locale: z.enum(["en", "id"]),
    timezone: z.string().max(64).refine(isValidTimezone, "Unknown timezone"),
    unitSystem: z.enum(["metric", "imperial"]),
    isPrivateAccount: z.boolean(),
    defaultActivityVisibility: z.enum(VISIBILITIES),
    nutritionVisibility: z.enum(DATA_VISIBILITIES),
    weightVisibility: z.enum(DATA_VISIBILITIES),
    measurementVisibility: z.enum(DATA_VISIBILITIES),
    notificationSettings: z.record(z.string(), z.boolean()),
    statsVisibility: statsVisibilitySchema,
  })
  .partial();
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
