import { sql } from "drizzle-orm";
import { cache } from "react";
import { isAdminRole } from "@/lib/constants";
import type { UpdateSiteSettingsInput } from "@/lib/validators/site";
import type { SessionUser } from "@/server/auth/session";
import { config } from "@/server/config";
import { getDb } from "@/server/db";
import { ApiError, forbidden } from "@/server/http/errors";
import { writeAudit } from "./audit";

const DEFAULTS = {
  siteName: "LIFTED",
  tagline: "Log workouts, track nutrition, share progress.",
  supportEmail: null as string | null,
  registrationOpen: true,
  googleSignupOpen: true,
  maintenanceMode: false,
  announcement: null as string | null,
};

type Row = {
  id: number;
  site_name: string;
  tagline: string;
  support_email: string | null;
  registration_open: boolean;
  google_signup_open: boolean;
  maintenance_mode: boolean;
  announcement: string | null;
  updated_at: Date;
};

export type SiteSettingsDto = typeof DEFAULTS & { googleConfigured: boolean; updatedAt: Date | null };

function toDto(row: Row): SiteSettingsDto {
  return {
    siteName: row.site_name,
    tagline: row.tagline,
    supportEmail: row.support_email,
    registrationOpen: row.registration_open,
    googleSignupOpen: row.google_signup_open,
    maintenanceMode: row.maintenance_mode,
    announcement: row.announcement,
    googleConfigured: config.google.configured,
    updatedAt: row.updated_at ?? null,
  };
}

async function loadRow(): Promise<Row> {
  const db = getDb();
  const found = await db.execute<Row>(sql`select * from site_settings where id = 1 limit 1`);
  if (found.rows[0]) return found.rows[0];
  const created = await db.execute<Row>(sql`insert into site_settings (id) values (1) on conflict (id) do nothing returning *`);
  if (created.rows[0]) return created.rows[0];
  const again = await db.execute<Row>(sql`select * from site_settings where id = 1 limit 1`);
  return (
    again.rows[0] ?? {
      id: 1,
      site_name: DEFAULTS.siteName,
      tagline: DEFAULTS.tagline,
      support_email: DEFAULTS.supportEmail,
      registration_open: DEFAULTS.registrationOpen,
      google_signup_open: DEFAULTS.googleSignupOpen,
      maintenance_mode: DEFAULTS.maintenanceMode,
      announcement: DEFAULTS.announcement,
      updated_at: new Date(),
    }
  );
}

/** Request-scoped; used by layouts and auth. */
export const getSiteSettings = cache(async () => toDto(await loadRow()));

export async function publicSite() {
  const s = await getSiteSettings();
  return {
    siteName: s.siteName,
    tagline: s.tagline,
    supportEmail: s.supportEmail,
    registrationOpen: s.registrationOpen,
    googleSignupOpen: s.googleSignupOpen && s.registrationOpen,
    googleConfigured: s.googleConfigured,
    maintenanceMode: s.maintenanceMode,
    announcement: s.announcement,
  };
}

export async function updateSiteSettings(actor: SessionUser, input: UpdateSiteSettingsInput) {
  if (!isAdminRole(actor.role)) throw forbidden("Only admins can change site settings");
  const db = getDb();
  await loadRow();
  const updated = await db.execute<Row>(sql`
    update site_settings set
      site_name = ${input.siteName},
      tagline = ${input.tagline},
      support_email = ${input.supportEmail ?? null},
      registration_open = ${input.registrationOpen},
      google_signup_open = ${input.googleSignupOpen},
      maintenance_mode = ${input.maintenanceMode},
      announcement = ${input.announcement ?? null},
      updated_by = ${actor.id}::uuid,
      updated_at = now()
    where id = 1
    returning *
  `);
  await writeAudit({
    userId: actor.id,
    action: "admin.site.update",
    entityType: "site",
    metadata: {
      registrationOpen: input.registrationOpen,
      googleSignupOpen: input.googleSignupOpen,
      maintenanceMode: input.maintenanceMode,
    },
  });
  return toDto(updated.rows[0]!);
}

export async function assertCanRegister(kind: "email" | "google") {
  const s = await getSiteSettings();
  if (!s.registrationOpen) throw new ApiError(403, "REGISTRATION_CLOSED", "New accounts are not being accepted right now");
  if (kind === "google" && !s.googleSignupOpen) {
    throw new ApiError(403, "REGISTRATION_CLOSED", "Google sign-up is turned off. Sign in with email or an existing Google account.");
  }
}
