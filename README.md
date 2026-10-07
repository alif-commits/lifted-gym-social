# LIFTED — Gym Social

A social workout log: record sessions, detect PRs, share to a feed, track nutrition (including AI meal-photo scanning) and progress.
Product docs live in [`markdown_docs/`](./markdown_docs) (PRD, ERD, TRD).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Drizzle ORM · Neon Postgres · Vercel Blob · Vercel AI Gateway · TanStack Query · zod.

## Getting started

Requires Node 20.11+.

```bash
npm install
cp .env.example .env.local      # then fill in DATABASE_URL (see below)
npm run db:migrate              # apply database/migrations
npm run db:seed                 # exercise library + common foods
npm run dev                     # http://localhost:3000
```

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon pooled connection string. |
| `APP_URL` | prod (falls back to the Vercel production URL) | Public origin, no trailing slash. Used for emails and OG tags. |
| `BLOB_READ_WRITE_TOKEN` | prod | Vercel Blob **private** store. Without it, uploads go to `./.data/uploads` (dev only). |
| `AI_GATEWAY_API_KEY` | optional | Without it (and without Vercel OIDC) the food scanner uses a deterministic mock provider. |
| `FOOD_SCAN_MODEL` | optional | AI Gateway `provider/model` id. Default `google/gemini-3.8-flash`. |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional | Required to actually send verification/reset mail. Default `EMAIL_FROM` with a key is `LIFTED <onboarding@resend.dev>` (Resend test sender; delivers only to the Resend account email). Verify your own domain in Resend to mail other addresses. Without a key, the in-app banner confirms the address directly. |
| `CRON_SECRET` | prod | Protects `/api/v1/cron/cleanup` (daily, see `vercel.json`). The route refuses to run in production without it. |
| `ADMIN_BOOTSTRAP_EMAIL` | optional | That email is granted **admin** on register, and by `npm run db:seed` if the account already exists. Staff sign in at `/admin/login`. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional | Enables Continue with Google. Existing email/password accounts still work and can link Google in Settings → Connections. |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | optional | One-way Strava import. Redirect `{APP_URL}/api/v1/integrations/strava/callback`. Imported sessions are marked Strava; native LIFTED workouts are unchanged. |
| `STRAVA_WEBHOOK_SECRET` | optional | Verify token for `GET/POST /api/v1/integrations/strava/webhook`. |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint (includes the React Compiler rules from `eslint-config-next`). |
| `npm test` | Unit tests (`tsx --test`): calculators, privacy rules, utilities. |
| `npm run smoke` | End-to-end API smoke test against a running server (`BASE_URL`, default `http://localhost:3000`). It registers throw-away `*@example.com` users; auth endpoints are rate limited, so clear the `rate_limits` table between repeated runs. |
| `npm run db:generate` | Generate a migration from `src/server/db/schema.ts`. |
| `npm run db:migrate` / `db:seed` / `db:studio` | Apply migrations, seed reference data, open Drizzle Studio. |

## Deploying to Vercel

1. Import the repo as a Vercel project and add the environment variables above.
2. Create a **private** Blob store and connect it to the project (sets `BLOB_READ_WRITE_TOKEN`).
3. Run `npm run db:migrate && npm run db:seed` once against the production database.
4. Set `CRON_SECRET`; Vercel Cron then calls `/api/v1/cron/cleanup` daily with `Authorization: Bearer $CRON_SECRET`.

Staff sign in at `/admin/login` (admin/moderator only). The **Admin** sidebar entry opens the dashboard (`/admin`): stats, users, reports, site settings (admin only), and an activity log. Site settings control registration, Google sign-up, maintenance mode, and the in-app announcement. Grant admin with `ADMIN_BOOTSTRAP_EMAIL`, the Users tab, or `update users set role = 'admin' where email = '…'`.

Published workouts are public at `/a/[shortId]`. From the workout or activity page you can copy that URL and download a generated **PNG / JPG / PDF** card (`GET /api/v1/activities/:id/export?format=`).
