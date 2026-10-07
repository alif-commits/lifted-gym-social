CREATE TABLE IF NOT EXISTS "site_settings" (
  "id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
  "site_name" varchar(40) DEFAULT 'LIFTED' NOT NULL,
  "tagline" varchar(120) DEFAULT 'Log workouts, track nutrition, share progress.' NOT NULL,
  "support_email" varchar(320),
  "registration_open" boolean DEFAULT true NOT NULL,
  "google_signup_open" boolean DEFAULT true NOT NULL,
  "maintenance_mode" boolean DEFAULT false NOT NULL,
  "announcement" varchar(240),
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "site_settings_singleton" CHECK ("id" = 1)
);
INSERT INTO "site_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
