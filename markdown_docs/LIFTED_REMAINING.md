# LIFTED — Remaining Work

Snapshot against `LIFTED_ROADMAP (1).md`. Phases 2, 3, and 5 are done in product. Phase 1 and 4 are in code with leftovers below.

Visual redesign (Phase 6) is **skipped** — listed only, not a work item. There is no `LIFTED_DESIGN_SYSTEM.md` requirement.

---

## Skipped

### Phase 6 — Visual redesign

Listed for the record. Do not implement.

Would have covered landing, auth, feed, activity cards/detail, workout, exercises, nutrition, scanner, progress, profile, leaderboards, notifications, settings, empty/loading/error, mobile layouts.

---

## Open

### Phase 1 — Exercise media (P0 leftover)

- GIFs / demo videos (schema supports IMAGE | GIF | VIDEO; seed is still photos)
- Images for the rest of the core library — only Bench, Deadlift, Squat, Barbell Row, Push-Up have media
- Missing media: OHP, front squat, pull-up, lat pulldown, RDL, walking lunge, plank, DB bench, others

Done already: detail page, setup/steps/breathing/mistakes, licensed `exercise_media`, add-to-workout without dropping an active session.

### Phase 4 — Strava (P0 leftover)

- Set `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` so Connect Strava appears
- Register a Strava webhook + `STRAVA_WEBHOOK_SECRET` (route exists, subscription does not)
- Optional: Strava brand marks on imported activities (disclaimer text is already there)

Done already: OAuth, token storage/refresh, backfill, Sync Now, incremental sync, disconnect (imports kept), source badge.

### Phase 7 — Social polish

- PR celebrations beyond a badge
- Shareable achievement art
- Richer Explore / athlete profiles
- Stronger Open Graph previews

Already there: activity cards, hashtag pages, suggested athletes, workout/nutrition share cards, basic public OG.

### Phase 8 — Advanced progress

- Volume by muscle group (sets-per-muscle chart exists; volume does not)
- Goal-milestone UX
- Personal trend summaries as a first-class view

Already there: estimated 1RM, records, goals, training calendar.

### Phase 9 — Nutrition intelligence

- Barcode scanning (column exists, no UI)
- Saved meals / recipes / meal duplication
- Restaurant food estimation
- Nutrition trends / better recognition

### Phase 10 — Challenges

Not started. 30-day, 100-sets, consistency, exercise challenges. Must not encourage unsafe volume.

### Phase 11 — Achievements

- Visual, optionally shareable cards (profile text badges exist)
- 7-day and 30-day streaks (4-week / 12-week exist)
- 1,000,000 kg volume badge

### Phase 12 — Mobile / PWA

- Real installable PWA (manifest only today)
- Push notifications
- Background sync
- Stronger offline than localStorage workout drafts
- Faster in-app camera (today: `<input capture>`)

### Phase 13 — Other integrations

Not started: Apple Health, Health Connect, Garmin, Fitbit, wearables, external nutrition databases.

---

## Suggested order

```text
1. Exercise media coverage (images, then GIF/video where licensed)
      ↓
2. Turn Strava on (env + webhook subscription)
      ↓
3. Social polish / achievements / progress
      ↓
4. Nutrition intelligence
      ↓
5. Challenges, PWA, other wearables — later
```
