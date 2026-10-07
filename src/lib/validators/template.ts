import { z } from "zod";
import { optionalText, uuid } from "./common";

export const templateExerciseSchema = z.object({
  exerciseId: uuid,
  targetSets: z.number().int().min(1).max(30).nullish(),
  targetReps: z.string().trim().max(24).nullish(),
  targetWeight: z.number().min(0).max(2000).nullish(),
  restSeconds: z.number().int().min(0).max(3600).nullish(),
  notes: optionalText(500),
});

export const templateInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalText(500),
  exercises: z.array(templateExerciseSchema).max(40),
});
export type TemplateInput = z.infer<typeof templateInputSchema>;

export const programInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalText(500),
  weeks: z
    .array(
      z.object({
        name: z.string().trim().max(80).nullish(),
        days: z
          .array(
            z.object({
              name: z.string().trim().min(1).max(80),
              notes: optionalText(500),
              exercises: z
                .array(
                  z.object({
                    exerciseId: uuid,
                    targetSets: z.number().int().min(1).max(30).default(3),
                    targetReps: z.string().trim().min(1).max(24).default("8-12"),
                    targetWeight: z.number().min(0).max(2000).nullish(),
                    notes: optionalText(500),
                  }),
                )
                .max(30),
            }),
          )
          .max(7),
      }),
    )
    .min(1)
    .max(16),
});
export type ProgramInput = z.infer<typeof programInputSchema>;
