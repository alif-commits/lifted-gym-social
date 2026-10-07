# LIFTED — Product Roadmap

**Version:** 1.0  
**Status:** Active Development Roadmap  
**Product:** LIFTED — Social Fitness Platform

---

## 1. Product Direction

LIFTED is a social fitness platform focused on gym training.

Core loop:

```text
Train → Track → Complete Activity → Share → Friends React → Progress → Train Again
```

Nutrition is the second major system:

```text
Eat → Log → Scan / Estimate → Review → Track Calories & Macros → Understand Progress
```

The roadmap should strengthen these two loops rather than adding unrelated features.

---

## 2. Development Philosophy

Prioritize:

1. Core workout experience
2. Social activity experience
3. Convenience
4. Nutrition intelligence
5. Visual polish
6. Advanced features

Avoid large secondary systems before the core product feels good.

---

## 3. Phase 1 — Exercise Media & Movement Guides

### Goal

Turn the exercise library into a useful reference instead of a list of exercise names.

### Features

- Exercise image
- GIF/animation where licensing permits
- Optional demonstration video
- Setup instructions
- Execution steps
- Breathing notes
- Common mistakes
- Primary/secondary muscles
- Equipment
- Exercise detail page

Example:

```text
Bench Press

[ IMAGE / GIF ]

Chest
Barbell

How to Perform
1. ...
2. ...
3. ...

Common Mistakes
- ...
- ...

[ Add to Workout ]
```

### Technical Direction

Add an exercise-media abstraction:

```text
Exercise
ExerciseMedia
```

Record:

- Provider
- Source URL
- Media type
- License
- Attribution
- Storage key when locally hosted

Do not depend on arbitrary Google Image results.

### Completion Criteria

- Core exercises have media
- Exercise detail page works
- Instructions work on mobile
- Sources/licensing are recorded
- Opening exercise information does not lose active workout state

---

## 4. Phase 2 — Google SSO

### Goal

Reduce signup/login friction.

### Features

- Continue with Google
- Existing account linking
- New account creation
- Secure logout/session handling

Flow:

```text
LOGIN
[ Continue with Google ]
OR
Email
Password
[ Login ]
```

### Completion Criteria

- Google login works
- New Google users can create LIFTED accounts
- Existing accounts can link Google
- Duplicate-account behavior is defined
- Sessions remain secure

---

## 5. Phase 3 — Friends & Leaderboards

### Goal

Give users a reason to keep training and checking LIFTED.

### Social Graph

- Follow
- Unfollow
- Follow request
- Accept/reject
- Remove follower
- Block
- Mute

### Leaderboard Types

- Workouts completed
- Training time
- Training volume
- Personal records
- Consistency / active days

### Time Windows

Primary:

- This Week
- This Month

Optional:

- All Time

Example:

```text
FRIENDS
THIS WEEK

1   Maya     5 workouts
2   Axis     4 workouts
3   Alex     4 workouts

VOLUME

1   Alex     38,420 kg
2   Axis     31,200 kg
3   Maya     28,900 kg
```

### Principle

Leaderboards should reward consistency as well as raw strength.

### Completion Criteria

- Friend leaderboard works
- Weekly ranking works
- Monthly ranking works
- Privacy rules are respected
- Blocked users are excluded
- Rankings update correctly after completed activities

---

## 6. Phase 4 — Strava API Integration

### Goal

Allow LIFTED users to connect their Strava account and import eligible Strava activities into LIFTED.

The first version is **one-way import from Strava into LIFTED**. Native LIFTED workouts remain first-class LIFTED records.

### User Flow

```text
Profile / Settings
      ↓
Connect Strava
      ↓
Strava OAuth
      ↓
User Grants Access
      ↓
LIFTED Stores Connection
      ↓
Initial Activity Import
      ↓
Imported Activities
```

### Import Scope

Initial import should cover:||
- Strava athlete connection
- Activity title
- Activity type / sport type
- Start time
- Elapsed time
- Distance where available
- Calories where available
- Relevant activity metadata
- Original Strava activity ID
- Source = Strava

Strava's current API exposes athlete activity endpoints and uses OAuth 2.0 scopes such as `activity:read` and `activity:read_all`; LIFTED should request only the minimum permissions needed for the intended import behavior.

### Sync

Support:

- Initial historical backfill
- Manual "Sync Now"
- Incremental synchronization
- Duplicate detection
- Imported activity status
- Disconnect Strava

Prefer Strava webhooks for activity updates and deauthorization handling instead of repeatedly polling for changes where practical.

### Data Model

Use an explicit external-source mapping so imported activities remain distinguishable from native LIFTED activities.

```text
ExternalConnection
ExternalActivity
```

Example:

```text
ExternalActivity
├── provider
├── external_activity_id
├── user_id
├── activity_id
├── imported_at
└── updated_at
```

The combination of provider + external activity ID + user should be unique.

### Authentication / Token Handling

Strava uses OAuth 2.0 with short-lived access tokens and refresh tokens. Refresh tokens can rotate, so LIFTED must securely replace stored refresh tokens whenever Strava returns a new one.

Never expose Strava access or refresh tokens to the browser.

### Disconnect

Users must be able to disconnect Strava.

Disconnect must:

- Stop future imports
- Stop synchronization
- Revoke/deauthorize access using the supported Strava flow
- Preserve or remove imported activities according to an explicit product policy

### Attribution / Compliance

Any Strava-sourced content shown in LIFTED must follow Strava's API agreement and branding/attribution requirements. LIFTED must not imply that it is sponsored by or affiliated with Strava.

### Completion Criteria

- User can connect Strava
- OAuth callback works
- Tokens are securely stored
- Initial activity import works
- Imported activities are distinguishable from native LIFTED activities
- Duplicate imports are prevented
- Manual sync works
- Incremental sync works
- Disconnect/deauthorization works
- Webhook support is implemented where required
- Privacy rules remain enforced
- Strava attribution/branding requirements are satisfied

---

## 7. Phase 5 — AI Nutrition Scanner

### Goal

Make food tracking dramatically faster than manual searching.

Entry methods:

```text
Add Food
├── Search Food
├── Manual Entry
├── Take Photo
└── Upload Image
```

AI flow:

```text
Photo
↓
Recognition
↓
Food Candidates
↓
Portion Estimate
↓
Nutrition Lookup
↓
Confidence
↓
User Review
↓
Save
```

### Critical Rule

AI results are drafts. The user must confirm them before final nutrition records are created.

Editable:

- Food
- Portion
- Unit
- Calories
- Protein
- Carbs
- Fat
- Fiber

### Completion Criteria

- Camera works where supported
- Upload works
- AI processing is asynchronous
- Food candidates appear
- Portions are editable
- Totals update
- User can confirm/reject
- Manual fallback works

---

## 8. Phase 6 — LIFTED Visual Redesign

### Goal

Transform the functional interface into a recognizable LIFTED product.

This is a dedicated design pass, not random CSS changes.

### Scope

Redesign:

- Landing page
- Login/register
- Home feed
- Activity cards
- Activity detail
- Workout screen
- Exercise pages
- Nutrition
- Food scanner
- Progress
- Profile
- Leaderboards
- Notifications
- Settings
- Empty/loading/error states
- Mobile layouts

### Visual Direction

```text
Social Fitness
+
Performance
+
Modern Gym Culture
```

LIFTED should not look like a generic black-and-white SaaS dashboard.

**Status:** skipped. Keep the current UI; do not run a dedicated redesign pass.

---

## 9. Phase 7 — Social Polish

Potential improvements:

- Better activity cards
- PR celebrations
- Achievements
- Friend suggestions
- Better Explore
- Hashtag discovery
- Better athlete profiles
- Share cards
- Open Graph previews

---

## 10. Phase 8 — Advanced Progress

Potential features:

- Volume by muscle group
- Estimated 1RM progression
- Exercise-specific records
- Training consistency
- Goal milestones
- Advanced charts
- Training calendar
- Personal trend summaries

---

## 11. Phase 9 — Nutrition Intelligence

Potential features:

- Barcode scanning
- Saved meals
- Recipe nutrition
- Meal duplication
- Better food search
- Restaurant food estimation
- Nutrition trends
- Improved recognition

---

## 12. Phase 10 — Challenges

Potential:

- 30 Day Workout Challenge
- 100 Sets Challenge
- 10 Workout Challenge
- Exercise challenges
- Consistency challenges

Challenges must not encourage unsafe or excessive exercise.

---

## 13. Phase 11 — Achievements

Examples:

```text
FIRST WORKOUT
10 WORKOUTS
50 WORKOUTS
100 WORKOUTS

FIRST PR
10 PRS

7 DAY STREAK
30 DAY STREAK

100,000 KG VOLUME
1,000,000 KG VOLUME
```

Achievements should be visual and optionally shareable.

---

## 14. Phase 12 — Mobile/PWA Enhancements

Potential:

- Installable PWA
- Better offline workout drafts
- Faster camera launch
- Full-screen workout mode
- Push notifications
- Background sync where practical

---

## 15. Phase 13 — Integrations

Only after the core product is strong:

- Apple Health
- Health Connect
- Garmin
- Fitbit
- Wearables
- External nutrition providers

Integrations must not compromise LIFTED's core workout model.

---

## 16. Priority Matrix

| Feature | Priority | Product Impact |
|---|---|---|
| Exercise images | P0 | High |
| Exercise instructions | P0 | High |
| Google SSO | P0 | High |
| Friends | P0 | High |
| Weekly leaderboard | P0 | High |
| Strava API import | P0 | High |
| Monthly leaderboard | P1 | High |
| AI food scanner | P0 | Very High |
| Camera food capture | P0 | Very High |
| Full visual redesign | skipped | — |
| Achievements | P1 | Medium |
| Challenges | P2 | Medium |
| Wearables | P2 | Medium |
| Advanced recommendations | P3 | Medium |

---

## 17. Immediate Next Sprint

```text
1. Exercise Media
      ↓
2. Google SSO
      ↓
3. Friends
      ↓
4. Leaderboards
      ↓
5. Strava API Import
      ↓
6. AI Food Scanner

Visual redesign is skipped.
```

---

## 18. Definition of Roadmap Success

LIFTED should feel like a real social fitness product where users record gym workouts, share activities, compete with friends, and track nutrition without feeling like they are using several disconnected apps.
