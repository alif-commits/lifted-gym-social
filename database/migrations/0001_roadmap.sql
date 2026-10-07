ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_sub" varchar(64);
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_sub_uq" ON "users" ("google_sub");

ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "setup_instructions" text;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "execution_steps" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "breathing_notes" text;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "common_mistakes" jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE "workouts" ADD COLUMN IF NOT EXISTS "source" varchar(16) DEFAULT 'LIFTED' NOT NULL;

CREATE TABLE IF NOT EXISTS "exercise_media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "exercise_id" uuid NOT NULL REFERENCES "exercises"("id") ON DELETE CASCADE,
  "provider" varchar(32) NOT NULL,
  "media_type" varchar(16) NOT NULL,
  "source_url" text,
  "storage_key" text,
  "license" varchar(80),
  "attribution" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "exercise_media_exercise_idx" ON "exercise_media" ("exercise_id");

CREATE TABLE IF NOT EXISTS "external_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" varchar(24) NOT NULL,
  "external_user_id" varchar(64) NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "token_expires_at" timestamp with time zone NOT NULL,
  "scope" text,
  "athlete_name" varchar(120),
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "external_connections_user_provider_uq" ON "external_connections" ("user_id", "provider");
CREATE INDEX IF NOT EXISTS "external_connections_provider_ext_idx" ON "external_connections" ("provider", "external_user_id");

CREATE TABLE IF NOT EXISTS "external_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" varchar(24) NOT NULL,
  "external_activity_id" varchar(64) NOT NULL,
  "workout_id" uuid REFERENCES "workouts"("id") ON DELETE SET NULL,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "external_activities_provider_ext_user_uq" ON "external_activities" ("provider", "external_activity_id", "user_id");
