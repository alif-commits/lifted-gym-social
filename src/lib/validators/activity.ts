import { z } from "zod";
import { REPORT_REASONS, REPORT_TARGETS } from "@/lib/constants";
import { optionalText, paginationQuery, uuid, visibility } from "./common";

export const createActivitySchema = z.object({ workoutId: uuid });

export const updateActivitySchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: optionalText(2000),
    visibility,
    showExerciseDetails: z.boolean(),
    locationName: optionalText(120),
  })
  .partial();
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;

export const reorderPhotosSchema = z.object({ photoIds: z.array(uuid).min(1).max(12) });

export const commentInputSchema = z.object({
  text: z.string().trim().min(1, "Write something").max(1000),
  parentCommentId: uuid.optional(),
});

export const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: uuid,
  reason: z.enum(REPORT_REASONS),
  details: optionalText(1000),
});

export const feedQuerySchema = paginationQuery;
export const exploreQuerySchema = paginationQuery.extend({
  sort: z.enum(["trending", "recent"]).default("trending"),
  tag: z.string().trim().toLowerCase().max(50).optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
  type: z.enum(["all", "users", "activities", "exercises", "hashtags"]).default("all"),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});
