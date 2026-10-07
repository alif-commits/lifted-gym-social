# Gym Social — Technical Requirements Document (TRD)

**Version:** 1.0  
**Status:** Baseline  
**Purpose:** Define how Gym Social should be built, deployed, secured, tested, and operated.

---

# 1. Technical Goals

The system must provide:

- Real authentication
- Real database persistence
- Real social feed
- Real workout tracking
- Real nutrition tracking
- Real AI food recognition workflow
- Strong privacy controls
- Mobile-friendly performance
- Horizontal scalability where needed
- Observability and recoverability

---

# 2. Recommended Architecture

Use a modular web architecture:

```text
Browser / Mobile Web
        |
        v
   Reverse Proxy
        |
        +-------------------+
        |                   |
        v                   v
     Web App             API Server
                            |
                +-----------+-----------+
                |           |           |
                v           v           v
            PostgreSQL    Redis      Object Storage
                |
                v
          Background Worker
                |
                +--------------------+
                |                    |
                v                    v
         AI Food Provider      Notification Provider
```

---

# 3. Recommended Stack

## Frontend

- React
- TypeScript
- Next.js or Vite
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod

## Backend

Recommended:

- Python
- FastAPI
- SQLAlchemy
- Alembic

Alternative:

- Node.js
- TypeScript
- NestJS

## Data

- PostgreSQL
- Redis
- S3-compatible object storage

## Infrastructure

- Docker
- Reverse proxy
- HTTPS
- CI/CD
- Monitoring

---

# 4. Repository Structure

```text
gym-social/
├── apps/
│   ├── web/
│   ├── api/
│   └── worker/
│
├── packages/
│   ├── ui/
│   ├── shared-types/
│   ├── validation/
│   └── config/
│
├── database/
│   ├── migrations/
│   └── seeds/
│
├── infrastructure/
│   ├── docker/
│   ├── reverse-proxy/
│   └── deployment/
│
├── docs/
│
└── tests/
```

---

# 5. Frontend Architecture

Recommended layer structure:

```text
UI Components
    ↓
Feature Modules
    ↓
Hooks / View Models
    ↓
API Client
    ↓
Backend API
```

Suggested modules:

```text
auth
feed
explore
activities
record
workouts
exercises
templates
programs
nutrition
food
food-scanner
calories
progress
profile
notifications
settings
```

---

# 6. Frontend State

Separate state into:

### Server state

Managed with TanStack Query or equivalent.

Examples:

- Feed
- Activities
- Profile
- Workout history
- Nutrition history

### Local UI state

Examples:

- Modal open state
- Tabs
- Filters

### Active workout state

Requires special resilience.

Must support:

- Local draft
- Autosave
- Restore after refresh
- Retry

---

# 7. Backend Architecture

Use domain modules.

```text
auth/
users/
profiles/
social/
activities/
workouts/
exercises/
templates/
programs/
nutrition/
foods/
food_scans/
calories/
progress/
notifications/
media/
moderation/
reports/
audit/
```

Each module should isolate:

- API routes/controllers
- Business logic
- Persistence/repositories
- Validation schemas
- Domain types

---

# 8. API Versioning

Base path:

`/api/v1`

Do not expose database implementation details directly through the public API.

---

# 9. API Style

REST is recommended for the initial platform.

Example:

```http
GET /api/v1/activities/feed
POST /api/v1/workouts
GET /api/v1/workouts/:id
POST /api/v1/workouts/:id/complete
POST /api/v1/activities/:id/publish
```

---

# 10. Authentication Technical Requirements

Use one of:

1. Secure HTTP-only cookie session
2. Access token + refresh token architecture

For a normal web application, HTTP-only secure cookies are recommended unless there is a strong reason to expose token-based authentication.

Requirements:

- Password hashing with Argon2id preferred
- Session expiry
- Session revocation
- Password reset tokens
- Email verification tokens
- Rate limiting
- Brute-force protection

---

# 11. Authorization

Authorization must be server-side.

Every private resource must pass:

```text
Authentication
    ↓
Resource lookup
    ↓
Ownership / privacy check
    ↓
Permission decision
    ↓
Response
```

Never rely on frontend route guards alone.

---

# 12. Privacy Enforcement

For activities:

```text
PUBLIC
→ visible according to public rules

FOLLOWERS
→ visible only to authorized followers

ONLY_ME
→ visible only to owner
```

For nutrition, weight, measurements, and progress photos:

Default access = owner only.

---

# 13. Social Graph Authorization

All feed and profile queries must account for:

- Follow state
- Private accounts
- Blocks
- Mutes
- Activity visibility

A blocked relationship must be applied before returning content.

---

# 14. Database

PostgreSQL is the source of truth.

Use:

- UUID primary keys
- Foreign keys
- Transactions
- Constraints
- Appropriate indexes
- Migrations

Do not use the frontend as a source of truth.

---

# 15. Transactions

Use transactions for operations that update multiple tables.

Examples:

### Completing workout

```text
Update workout
Create/update PRs
Create activity if publishing
Create notifications
Commit
```

### Confirming food scan

```text
Confirm scan items
Create/update nutrition entries
Update meal totals if materialized
Commit
```

---

# 16. Idempotency

Critical operations should be idempotent or protected against duplicate requests.

Examples:

- Like activity
- Complete workout
- Publish activity
- Confirm food scan
- Create nutrition entry after retry

Use idempotency keys or unique constraints where appropriate.

---

# 17. Feed Architecture

Initial implementation:

```text
Follow graph
   ↓
Query recent visible activities
   ↓
Apply privacy/block/mute filters
   ↓
Sort by published_at
   ↓
Cursor pagination
```

Do not build a complex ranking system initially.

---

# 18. Feed Pagination

Use cursor-based pagination.

Example:

```http
GET /api/v1/activities/feed?limit=20&cursor=...
```

Return:

```json
{
  "items": [],
  "next_cursor": "..."
}
```

---

# 19. Activity Creation

Recommended flow:

```text
Workout Complete
      ↓
Create Activity Draft
      ↓
Upload Photos
      ↓
Set Metadata
      ↓
Set Visibility
      ↓
Publish
```

Do not require the raw workout to be public.

---

# 20. Media Architecture

Use object storage.

Example:

```text
Object Storage
├── avatars/
├── activities/
├── progress/
└── food-scans/
```

Database stores:

- Object key
- Width
- Height
- MIME type
- Size
- Owner
- Creation timestamp

---

# 21. Image Upload Security

Validate:

- MIME type
- File extension
- Size
- Image parsing
- Content
- Ownership

Recommended pipeline:

```text
Upload
 ↓
Validate
 ↓
Scan
 ↓
Resize
 ↓
Create thumbnail
 ↓
Store
```

---

# 22. CDN

A CDN can be used for:

- Public activity photos
- Avatars
- Static assets

Private media must use signed URLs or equivalent access control.

---

# 23. Workout Autosave

Active workout should use:

```text
Frontend local state
        +
Periodic API save
```

Recommended behavior:

- Save after set completion
- Save after exercise modifications
- Save on background/visibility change where supported

If network fails:

- Keep local draft
- Show offline state
- Retry safely

---

# 24. Rest Timer

The rest timer should not depend on a server request.

It runs locally and persists its state as appropriate.

---

# 25. Workout Calculations

Server must remain authoritative for:

- Duration
- Volume
- PRs
- Final workout statistics

Frontend may calculate preview values for UX.

---

# 26. PR Calculation Service

Create a dedicated service:

```text
PRService
```

Responsibilities:

- Determine whether a new PR exists
- Compare relevant historical records
- Store PR
- Generate achievement event

---

# 27. 1RM Calculation Service

Dedicated service:

```text
OneRepMaxService
```

Supported:

- Epley
- Brzycki
- Lombardi

Formula selection should be configurable.

---

# 28. Calorie Calculation Service

Dedicated service:

```text
CalorieService
```

Responsibilities:

- Validate input
- Calculate age
- Calculate BMR
- Calculate TDEE
- Apply goal adjustment
- Return target

The formula and settings must be explicit in the returned result.

---

# 29. Nutrition Calculation Service

Dedicated service:

```text
NutritionService
```

Responsibilities:

- Food normalization
- Quantity scaling
- Macro totals
- Fiber totals
- Daily totals
- Goal comparison

All calculations must be deterministic given the same input.

---

# 30. Food Quantity Scaling

Food records should be stored at a defined serving basis.

Example:

```text
Serving size = 100g

Calories = 150
Protein = 10g
Carbs = 20g
Fat = 4g
Fiber = 2g
```

For 250g:

```text
Multiplier = 2.5
```

Each nutrition field is scaled by the multiplier.

---

# 31. AI Food Scanner Architecture

Do not let the vision model directly write to nutrition tables.

Required architecture:

```text
Client
  ↓
Food Scan API
  ↓
FoodScan record
  ↓
Job Queue
  ↓
AI Recognition Worker
  ↓
Vision Model
  ↓
Recognized Candidates
  ↓
Nutrition Resolver
  ↓
Confidence
  ↓
FoodScanItem records
  ↓
User Review
  ↓
Confirm
  ↓
NutritionEntry records
```

---

# 32. AI Provider Interface

Define an abstraction such as:

```python
class FoodRecognitionProvider:
    async def analyze(self, image_url: str) -> list[RecognizedFood]:
        ...
```

Provider response should contain structured data.

Example:

```json
{
  "name": "grilled chicken",
  "estimated_quantity": 150,
  "unit": "g",
  "confidence": 0.91
}
```

---

# 33. Nutrition Resolver

The vision model's output should be mapped to nutrition data.

Pipeline:

```text
"grilled chicken"
        ↓
Normalize name
        ↓
Search food database
        ↓
Select candidate
        ↓
Scale for portion
        ↓
Return nutrition estimate
```

Matching confidence should be separate from vision confidence.

---

# 34. AI Review Requirement

The frontend must show AI results as a draft.

Never automatically insert unreviewed AI results into the user's final nutrition history.

---

# 35. AI Confidence

Store confidence separately for:

- Recognition
- Food match
- Portion estimate

Example:

```text
vision_confidence = 0.91
food_match_confidence = 0.88
portion_confidence = 0.61
```

This can later be simplified in the UI to one overall confidence indicator.

---

# 36. AI Asynchronous Processing

Food analysis should use a background job.

States:

```text
UPLOADING
PROCESSING
COMPLETED
FAILED
CANCELLED
```

API should return a job/scan ID immediately.

Frontend polls or receives updates.

---

# 37. AI Failure Handling

If provider fails:

- Mark scan FAILED
- Preserve uploaded image unless deletion policy says otherwise
- Provide retry
- Provide manual entry
- Log technical error without exposing secrets

---

# 38. AI Cost Control

Implement:

- Image resizing
- Compression
- Maximum image size
- Explicit user-triggered scans
- Duplicate scan detection where useful
- Caching of current scan result

Do not repeatedly call AI for simple UI edits.

---

# 39. Nutrition Privacy

Food scans and nutrition data are private by default.

Do not include them in a normal public activity API unless the user explicitly creates a shareable nutrition card.

---

# 40. Public Nutrition Share

If a user chooses to publish a nutrition summary:

```text
Create Share Card
    ↓
Select metrics
    ↓
Generate public content
    ↓
Publish
```

This should remain separate from raw nutrition records.

---

# 41. Search Architecture

Search initial scope:

- Username
- Display name
- Exercise name
- Food name
- Hashtag

PostgreSQL search is sufficient initially.

A dedicated search engine can be introduced later if scale requires it.

---

# 42. Notifications Architecture

Persist notification records.

Use background jobs for:

- Notification creation where expensive
- Email delivery
- Digest delivery

In-app notification retrieval should be direct from PostgreSQL or cache-backed.

---

# 43. Background Worker

Worker handles:

- AI food scans
- Image processing
- Notifications
- Data exports
- Cleanup jobs
- Analytics aggregation where needed

---

# 44. API Error Handling

Use consistent errors:

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Activity not found"
  }
}
```

Do not expose stack traces in production.

---

# 45. HTTP Status Codes

Examples:

- 200 OK
- 201 Created
- 204 No Content
- 400 Bad Request
- 401 Unauthorized
- 403 Forbidden
- 404 Not Found
- 409 Conflict
- 422 Validation Error
- 429 Too Many Requests
- 500 Internal Server Error

---

# 46. Rate Limiting

Rate-limit:

- Login
- Registration
- Password reset
- Follow/unfollow
- Comment creation
- Activity creation
- AI scan creation
- Uploads

AI scan creation should have separate cost-aware limits.

---

# 47. Security Headers

Configure:

- Content-Security-Policy
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- Strict-Transport-Security

---

# 48. Secret Management

Secrets must live in:

- Environment variables
- Secret manager

Never commit:

- API keys
- Database passwords
- AI provider keys
- JWT secrets
- Storage secrets

---

# 49. Logging

Log:

- Request ID
- User ID where available
- Route
- Status
- Duration
- Error category

Never log:

- Passwords
- Tokens
- Raw authentication secrets
- Private food images as binary payloads

---

# 50. Monitoring

Monitor:

### API

- Latency
- Error rate
- Throughput

### Database

- Connections
- Slow queries
- CPU
- Storage

### Worker

- Job latency
- Failure rate
- Queue depth

### AI

- Request count
- Cost
- Failure rate
- Average processing time

---

# 51. Health Endpoints

```http
GET /health
GET /ready
```

`/health` checks process health.

`/ready` checks critical dependencies.

---

# 52. Database Migrations

Use Alembic or equivalent.

Rules:

- Every schema change via migration
- Migrations version-controlled
- Never manually edit production schema without migration record

---

# 53. Seed Data

Initial seeds:

- Exercise catalog
- Muscle groups
- Equipment
- Activity types
- Goal types
- Activity multipliers
- Default system values

Food database seeding can be separate because it may be large.

---

# 54. Testing Strategy

### Unit

- Calculations
- Privacy logic
- Feed filtering
- Nutrition scaling
- PR detection

### Integration

- Auth
- Workout CRUD
- Social graph
- Activity publishing
- Nutrition CRUD
- Food scan pipeline

### E2E

- Registration → workout → publish
- Follow → feed → like → comment
- Photo → AI scan → review → save nutrition
- Weight → progress chart

---

# 55. AI Testing

Do not only test the AI provider.

Test the complete pipeline:

```text
Input image
  ↓
Recognition response
  ↓
Normalization
  ↓
Nutrition matching
  ↓
Portion scaling
  ↓
User correction
  ↓
Final nutrition entry
```

Provider output should be mocked in deterministic tests.

---

# 56. Mobile Technical Requirements

Use responsive layouts.

Special handling:

- Camera permission
- File input
- Numeric input
- Long-running workout page
- Background/visibility changes
- Large touch targets

---

# 57. PWA Consideration

A PWA is recommended as a future-friendly option.

Potential capabilities:

- Install to home screen
- Faster repeated access
- Better full-screen workout experience
- Limited offline support

A true offline-first architecture is not mandatory in v1.

---

# 58. Performance Requirements

Targets:

- Initial authenticated page < 2 seconds under normal conditions
- Standard API < 500 ms target
- Workout set save < 1 second target
- Feed first page < 2 seconds target
- Activity page < 2 seconds target

AI scan is asynchronous and excluded from synchronous page latency targets.

---

# 59. Caching

Recommended cache targets:

- Public exercise catalog
- Public static metadata
- Frequently requested profile summaries
- Feed fragments if later needed

Never allow cached private data to cross user boundaries.

---

# 60. Database Query Rules

Avoid:

- N+1 queries
- Full table scans for standard requests
- Unbounded result sets
- Loading complete user history for a single page

Use:

- Indexes
- Joins/preloading
- Pagination
- Aggregation queries

---

# 61. Feed Query Rules

For a feed request:

1. Determine followed user IDs
2. Exclude blocked/muted users
3. Filter activities by visibility
4. Order by published_at
5. Use cursor
6. Return only required fields

Do not fetch full workouts and nutrition for every feed card.

---

# 62. Activity Read Model

The API may expose a denormalized activity summary.

Example:

```json
{
  "id": "...",
  "user": {
    "username": "axis",
    "display_name": "Axis"
  },
  "title": "Push Day",
  "duration_seconds": 3840,
  "exercise_count": 6,
  "set_count": 18,
  "volume": 9280,
  "cover_photo": "...",
  "likes_count": 31,
  "comments_count": 8
}
```

This avoids returning the complete raw workout graph in the feed.

---

# 63. Activity Detail API

Activity detail can load:

- Activity summary
- Photos
- Workout summary
- Optional exercise/set details according to visibility
- Social counts
- Comments

---

# 64. Privacy-Aware Serialization

Response serializers must remove fields the viewer is not allowed to see.

Example:

A public activity may expose:

```text
Exercises
Sets
Volume
Duration
```

but omit:

```text
User weight
Personal nutrition
Private notes
Private measurements
```

---

# 65. Object Storage Access

Public media:

- Public URL or CDN URL

Private media:

- Signed URL
- Authorization checked before issuing URL

---

# 66. Data Export Architecture

Exports should be background jobs for large users.

```text
Request Export
 ↓
Create export job
 ↓
Worker builds files
 ↓
Store export
 ↓
Notify user
 ↓
Download
```

---

# 67. Account Deletion Architecture

Recommended process:

```text
Deletion Requested
 ↓
Re-authenticate
 ↓
Confirm
 ↓
Disable account
 ↓
Revoke sessions
 ↓
Delete/anonymize records
 ↓
Delete private media
 ↓
Complete
```

Retention rules must be documented.

---

# 68. Deployment

Minimum environments:

```text
development
staging
production
```

Production:

```text
Reverse Proxy
   ↓
Web
   ↓
API
   ↓
PostgreSQL
   ↓
Redis
   ↓
Worker
   ↓
Object Storage / AI Provider
```

---

# 69. CI/CD

Pipeline:

```text
Commit
 ↓
Lint
 ↓
Type Check
 ↓
Unit Tests
 ↓
Integration Tests
 ↓
Build
 ↓
Security Scan
 ↓
Deploy Staging
 ↓
Smoke Test
 ↓
Deploy Production
```

Rollback must be possible.

---

# 70. Backups

PostgreSQL requires:

- Scheduled backup
- Retention policy
- Off-site copy
- Restore verification

Media storage requires:

- Versioning or backup
- Retention policy
- Recovery test

---

# 71. Disaster Recovery

Document:

- RPO
- RTO
- Backup frequency
- Restore instructions
- Database migration rollback strategy
- Media recovery

---

# 72. Localization

Initial locales:

- English
- Indonesian

Store:

- User locale
- Timezone

Store timestamps in UTC.

---

# 73. Timezone Handling

Daily nutrition boundaries must use user's timezone.

Example:

A food logged at `23:30` local time belongs to the local calendar day even if stored as another UTC date.

---

# 74. Accessibility

Target WCAG 2.1 AA.

Requirements:

- Keyboard access
- Focus states
- Proper labels
- Accessible errors
- Semantic HTML
- Screen-reader support
- Chart summaries
- Accessible camera fallback

---

# 75. Technical Non-Goals

Not required in the initial architecture:

- Native mobile application
- Wearable integrations
- Real-time chat
- Video streaming
- Complex recommendation engine
- Full offline-first support
- Full external gym directory
- Commercial gym ERP

The architecture should not block future additions.

---

# 76. Technical Definition of Done

A feature is technically complete only when:

- API exists
- Database schema exists
- Validation exists
- Authorization exists
- Error handling exists
- Tests exist
- Logging exists where appropriate
- Documentation exists
- Mobile behavior has been tested
- Security implications have been reviewed

---

# 77. Recommended Build Order

### Phase 1

- Repository
- PostgreSQL
- Auth
- User/profile
- API framework
- Frontend shell

### Phase 2

- Exercise catalog
- Workout logging
- Active workout
- Workout history

### Phase 3

- Activities
- Feed
- Follow
- Likes
- Comments
- Notifications

### Phase 4

- Calories
- Nutrition
- Food database
- Weight
- Progress

### Phase 5

- AI food scanning
- Camera
- Background worker
- Nutrition resolution

### Phase 6

- Advanced analytics
- Achievements
- Explore
- Moderation
- Exports

### Phase 7

- Performance hardening
- Security review
- Observability
- Backup/restore
- Production launch

---

# 78. Technical Principle

The system should keep the following boundaries clear:

```text
PRD
"What should the user be able to do?"

ERD
"What data must exist?"

TRD
"How do we implement it safely and reliably?"
```

The three documents must evolve together but must not become the same document.
