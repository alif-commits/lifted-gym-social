<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# LIFTED — agent notes

Facts below were detected from the repo. Update them when the stack changes.

## 1. Tech Stack

- **Framework:** Next.js 16.4 (App Router, Turbopack, `src/proxy.ts` instead of middleware), React 19.3, TypeScript (strict). Package manager: npm. Runtime: Node 20.11+.
- **Styling:** Tailwind CSS 4 with CSS-variable tokens (`src/app/globals.css`, `@theme inline`), dark-first with a light theme via `html[data-theme="light"]`. Accent `#c8f031`. No component library: primitives live in `src/components/ui`.
- **Data:** Neon Postgres via `pg`, Drizzle ORM (`src/server/db/schema.ts`, SQL migrations in `database/migrations`), seeds in `database/seeds`.
- **Client state / data fetching:** TanStack Query; forms use React Hook Form + zod resolvers; icons from lucide-react.
- **Validation:** zod 4 (`src/lib/validators`), shared by API routes and forms.
- **Auth:** own session cookie (hashed token in `sessions`), argon2 (`@node-rs/argon2`), email verification and password reset via tokens (Resend when configured, otherwise logged). Optional Google SSO (`/api/v1/auth/google`) sits beside email login. Staff-only login is `POST /api/v1/auth/admin-login`. Roles: `user` | `moderator` | `admin`. `ADMIN_BOOTSTRAP_EMAIL` promotes that account on register/seed.
- **Media:** `sharp` for processing; Vercel Blob private store in production, `./.data/uploads` in development (`src/server/storage.ts`).
- **AI:** AI SDK 7 through Vercel AI Gateway for food-photo scanning (`src/server/ai`); deterministic mock provider without a key.
- **Testing:** `tsx --test` unit tests in `tests/`; `scripts/smoke.mjs` API smoke test. No component or E2E framework.
- **Lint:** ESLint 9 with `eslint-config-next` (includes React Compiler rules). No Prettier config.
- **Deployment:** Vercel (`vercel.json` defines the daily cron at `/api/v1/cron/cleanup`).

Commands: `npm run dev | build | typecheck | lint | test | smoke | db:migrate | db:seed`. See `README.md` for env vars.

## 2. Architecture

- **Routing:** App Router with three page groups in `src/app`: `(auth)` login/register/reset/verify plus `/admin/login`, `(app)` session-guarded pages inside `AppShell` (including `/admin` staff dashboard and `/leaderboards`), `(public)` shareable pages (`/a/[shortId]`, `/u/[username]`, `/s/[id]`) that work signed out. `/workout/*` is the live recorder; `/workouts/*` is history, detail and publish. Public workout cards also export at `GET /api/v1/activities/:id/export?format=png|jpg|pdf`. Strava OAuth lives at `/api/v1/integrations/strava`. Admin site settings (`site_settings`, `/admin` Site tab) control registration, Google sign-up, maintenance, and the app announcement banner.
- **API:** REST route handlers under `src/app/api/v1/**`, wrapped with `route.public|auth(fn, { rateLimit, roles })` from `src/server/http/handler.ts`. Responses use the envelope `{ success, data }` / `{ success: false, error: { code, message, details, requestId } }`. Lists use keyset pagination `{ items, next_cursor }`. Mutations are same-origin checked.
- **Server layers:** `src/server/services/*` hold business logic and DB access (route handlers stay thin); `src/server/auth`, `http`, `db`, `ai`, `storage.ts` are infrastructure. Privacy is enforced in SQL (see `activityVisibleTo`); non-owners get 404 for hidden activities.
- **Client layers:** `src/lib/client` (API client, hooks, formatting, `toClient()` serialiser), `src/components/app` (feature components), `src/components/ui` (primitives), `src/components/charts` (SVG charts). Server DTO types are imported type-only into client code via `Serialized<T>`.
- **Server vs client:** pages are server components that guard sessions and pass serialised props (`toClient`); interactive views are `"use client"` components that fetch through TanStack Query (`useList` for paginated lists, query keys such as `["unread"]`, `["active-workout"]`, `["me"]`).
- **Units:** weights are stored in kg; the UI converts with `useUnits()` (`kgToDisplay` / `displayToKg`).
- **Workout recorder:** full-state autosave (`PUT /workouts/:id`, debounced, retried, mirrored to `localStorage` draft `lifted-workout-draft:<id>`).
- **Testing structure:** pure logic (calculators, privacy, formatting) in `tests/*.test.ts`; API behaviour via `npm run smoke`.
