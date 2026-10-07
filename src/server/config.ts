import { ONE_RM_FORMULAS, type OneRepMaxFormula } from "@/lib/constants";

const isProd = process.env.NODE_ENV === "production";

function oneRmFormula(): OneRepMaxFormula {
  const v = (process.env.ONE_RM_FORMULA ?? "EPLEY").toUpperCase();
  return (ONE_RM_FORMULAS as readonly string[]).includes(v) ? (v as OneRepMaxFormula) : "EPLEY";
}

export const config = {
  isProd,
  appUrl: (process.env.APP_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")).replace(/\/$/, ""),
  session: {
    cookieName: isProd ? "__Host-lifted_session" : "lifted_session",
    ttlDays: 30,
    refreshAfterMs: 24 * 60 * 60 * 1000,
  },
  oneRmFormula: oneRmFormula(),
  blobConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID),
  ai: {
    model: process.env.FOOD_SCAN_MODEL ?? "google/gemini-3.8-flash",
    gatewayConfigured: Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN),
    maxAttempts: 2,
  },
  email: {
    resendKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM ?? "LIFTED <no-reply@example.com>",
  },
  cronSecret: process.env.CRON_SECRET,
  /** Email that is granted admin on register (and by `db:seed` if the account already exists). */
  adminBootstrapEmail: process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase() || null,
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  },
  strava: {
    clientId: process.env.STRAVA_CLIENT_ID ?? "",
    clientSecret: process.env.STRAVA_CLIENT_SECRET ?? "",
    webhookSecret: process.env.STRAVA_WEBHOOK_SECRET ?? "",
    configured: Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET),
  },
};
