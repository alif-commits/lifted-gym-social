import { z } from "zod";

const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

export const updateSiteSettingsSchema = z.object({
  siteName: z.string().trim().min(1, "Enter a site name").max(40),
  tagline: z.string().trim().max(120).default(""),
  supportEmail: z.preprocess(emptyToUndef, z.string().trim().email("Enter a valid email").max(320).optional()),
  registrationOpen: z.boolean(),
  googleSignupOpen: z.boolean(),
  maintenanceMode: z.boolean(),
  announcement: z.preprocess(emptyToUndef, z.string().trim().max(240).optional()),
});

export type UpdateSiteSettingsInput = z.infer<typeof updateSiteSettingsSchema>;
