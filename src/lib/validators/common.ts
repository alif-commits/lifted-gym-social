import { z } from "zod";
import { VISIBILITIES } from "@/lib/constants";
import { isDateString } from "@/lib/tz";

export const uuid = z.uuid();
export const visibility = z.enum(VISIBILITIES);
export const dateString = z.string().refine(isDateString, "Expected a date in YYYY-MM-DD format");
export const isoDateTime = z.iso.datetime({ offset: true });

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const paginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(300).optional(),
});
