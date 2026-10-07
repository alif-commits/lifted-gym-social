# Gym Social — Product Requirements Document (PRD)

**Version:** 1.0  
**Status:** Baseline  
**Product:** Social fitness platform for gym/strength training  
**Primary inspiration:** Strava-style activity sharing, adapted for gym workouts

---

## 1. Product Vision

Gym Social is a social fitness platform where gym workouts are recorded as **activities** that users can optionally publish and share with other athletes.

The product combines:

- Gym workout tracking
- Activity publishing
- Social feed
- Followers/following
- Likes and comments
- Public athlete profiles
- Personal records and training statistics
- Calorie and macro tracking
- Food logging
- AI-assisted food recognition from images/camera
- Weight and progress tracking

The product is **not** a gym-management ERP.

It is a social consumer fitness product.

---

## 2. Core User Promise

A user should be able to:

1. Create an account.
2. Build a fitness profile.
3. Start a gym workout.
4. Record exercises, sets, reps, weight, RPE/RIR, and notes.
5. Finish the workout.
6. See workout statistics and PRs.
7. Publish the workout as an activity.
8. Have followers see the activity.
9. Receive likes/comments.
10. Track calories, protein, carbs, fat, fiber, and other nutrients.
11. Photograph food or upload an image.
12. Get an AI estimate of foods and portions.
13. Review/correct the estimate.
14. Save the meal.
15. See daily and historical nutrition/progress.

---

## 3. Product Principles

### Activity first

The main social object is the completed **activity**, not the raw database workout record.

### Social by default, private by control

Users should have a simple way to publish activities while sensitive records such as nutrition, body weight, and measurements remain private by default.

### Fast workout logging

Recording a set should require minimal interaction.

### AI assists, user confirms

AI food recognition is an estimate. The user must confirm or edit results before they become final nutrition records.

### Persistent data

All important user data must be stored in the database and survive refreshes, logout/login, and device changes.

---

## 4. Target Users

### Athlete

Normal user who records workouts and tracks fitness.

### Social Athlete

User who regularly publishes activities and interacts with the community.

### Advanced Strength User

User who cares about sets, RPE/RIR, volume, PRs, 1RM, and progression.

### Nutrition-Focused User

User who wants calories and macro tracking with fast food logging.

---

## 5. Major Product Areas

### 5.1 Account

- Registration
- Login
- Logout
- Email verification
- Password reset
- Profile
- Username
- Privacy settings
- Notification settings

### 5.2 Workout Tracking

- Start workout
- Start from template
- Repeat previous workout
- Add exercise
- Add sets
- Log weight/reps
- Log RPE/RIR
- Rest timer
- Reorder exercises
- Edit/delete sets
- Complete workout
- Save workout privately

### 5.3 Activity Publishing

- Convert completed workout into activity
- Title
- Description
- Photos
- Hashtags
- Visibility
- Activity summary
- Public activity URL

### 5.4 Social

- Home feed
- Explore
- Follow
- Unfollow
- Follow requests
- Likes
- Comments
- Replies
- Bookmarks
- Mentions
- Notifications
- Block
- Mute
- Report

### 5.5 Exercise & Training

- Exercise catalog
- Custom exercises
- Workout templates
- Training programs
- Previous performance
- Training volume
- PRs
- Estimated 1RM
- Progression history

### 5.6 Nutrition

- BMR calculator
- TDEE calculator
- Calorie targets
- Macro targets
- Food database
- Manual food logging
- Meals
- Daily totals
- Nutrition history
- Fiber tracking
- Optional additional nutrients

### 5.7 AI Food Scanner

- Camera capture
- Image upload
- Food recognition
- Multi-food detection
- Portion estimation
- Nutrition database matching
- Confidence values
- Edit results
- Add missing food
- Remove incorrect food
- Confirm and save

### 5.8 Progress

- Weight
- Body measurements
- Progress photos
- Strength charts
- Volume charts
- Workout frequency
- Nutrition trends
- Goals
- PRs
- Streaks

---

## 6. User Account Requirements

### Registration

Required:

- Email
- Password
- Username
- Display name

Optional onboarding:

- Date of birth
- Sex
- Height
- Weight
- Activity level
- Fitness goal

### Username

- Unique
- URL-safe
- Changeable under configurable limits

Example:

`/u/axis`

---

## 7. Athlete Profile

Profile should contain:

- Avatar
- Username
- Display name
- Bio
- Followers
- Following
- Activity count
- Optional public statistics
- Public achievements
- Public activity history

Users control whether statistics are public.

---

## 8. Social Graph

Users can:

- Follow public accounts
- Request to follow private accounts
- Unfollow
- Remove followers
- Block
- Mute

Blocking and privacy rules must affect feed, search, profiles, comments, and activity access.

---

## 9. Home Feed

The feed contains activities from followed athletes.

Example card:

```text
Axis
Push Day
Today · 1h 04m

6 Exercises
18 Sets
9,280 kg Volume

[Photo]

Bench Press
65 kg × 7

Incline Dumbbell Press
22 kg × 8

♥ 31    Comment 8
```

Initial feed order may be chronological.

---

## 10. Explore

Explore is for public content discovery.

Potential sections:

- Trending activities
- Popular athletes
- Recent public activities
- Hashtags
- Exercise-related content

The recommendation system can remain simple initially.

---

## 11. Activity Model — Product Behavior

A workout can exist without being published.

A published activity is the social representation of that workout.

Flow:

```text
Start Workout
    ↓
Log Workout
    ↓
Complete Workout
    ↓
Review Summary
    ↓
Create Activity
    ↓
Choose Visibility
    ↓
Publish
```

Deleting an activity should be conceptually separate from deleting the underlying workout.

---

## 12. Workout Logging

Active workout must support:

- Exercise selection
- Previous performance
- Set entry
- Weight
- Reps
- RPE
- RIR
- Rest timer
- Notes
- Exercise reorder

Different exercise types may expose different fields.

### Strength

- Weight
- Reps
- RPE/RIR

### Bodyweight

- Reps
- Optional added weight

### Timed

- Duration

### Distance/cardio

- Distance
- Duration

---

## 13. Workout Recovery

An active workout must survive:

- Page refresh
- Temporary network failure
- Accidental navigation where recoverable

The UI should offer:

- Resume
- Discard
- Continue

---

## 14. Workout Summary

On completion, calculate:

- Duration
- Exercise count
- Set count
- Rep count where meaningful
- Total volume
- Personal records
- Estimated calories burned where supported

Calories burned are estimates and must be labeled as such.

---

## 15. Exercise Catalog

Global exercise records include:

- Name
- Description
- Instructions
- Primary muscle
- Secondary muscles
- Equipment
- Exercise type
- Tracking mode
- Difficulty
- Optional media

Users can create custom exercises that belong only to their account.

---

## 16. Templates

Users can create reusable workout templates.

Examples:

- Push
- Pull
- Legs
- Upper
- Lower
- Full Body
- Custom

Templates store exercise order and optional targets.

---

## 17. Programs

Programs contain weeks and training days.

Example:

```text
Program
└── Week 1
    ├── Day 1 — Upper
    ├── Day 2 — Lower
    └── Day 3 — Upper
```

Programs are optional and can be simple in the first implementation.

---

## 18. Personal Records

Possible PRs:

- Maximum weight
- Estimated 1RM
- Rep PR
- Volume PR
- Duration PR
- Distance PR

A new PR can generate an achievement notification.

---

## 19. Social Activity Publishing

Publishing screen:

```text
Workout Complete

Title: Push Day
Description: Great session.

Duration: 64 min
Exercises: 6
Sets: 18
Volume: 9,280 kg

Photos: [Add]

Visibility: Public

[Publish]
```

---

## 20. Activity Visibility

Supported:

- Public
- Followers
- Only Me

Defaults are configurable.

Sensitive data must remain separate from basic activity visibility.

---

## 21. Activity Privacy Controls

Potential per-activity fields:

- Workout title
- Exercise names
- Weight
- Reps
- Volume
- Duration
- PRs
- Photos
- Gym/location
- Calories burned

The product may begin with a simpler visibility model and expand later.

---

## 22. Photos

Activities support multiple photos.

Sources:

- Camera
- Gallery

The system supports:

- Upload
- Crop
- Reorder
- Cover selection
- Remove

---

## 23. Likes

Users can like an activity.

Requirements:

- One like per user/activity
- Toggle like/unlike
- Like count
- Notification to activity owner

---

## 24. Comments

Users can:

- Comment
- Reply
- Edit own comment
- Delete own comment
- Like comments
- Report comments

---

## 25. Notifications

Initial notifications:

- New follower
- Follow request
- Follow accepted
- Activity like
- Comment
- Comment reply
- Mention
- PR
- Goal milestone

---

## 26. Search

Search:

- Users
- Activities
- Exercises
- Hashtags

Search must respect privacy and blocking.

---

## 27. Hashtags

Activities may contain hashtags.

Examples:

- `#PushDay`
- `#LegDay`
- `#Hypertrophy`

Hashtags can be discovered through Explore.

---

## 28. Moderation

Users can report:

- Profiles
- Activities
- Comments
- Images

Reasons:

- Spam
- Harassment
- Hate
- Sexual content
- Dangerous content
- Misleading content
- Other

Reported content enters a moderation system.

---

## 29. Blocking and Muting

### Block

Prevents normal interaction and appropriate access.

### Mute

Keeps following relationship but removes that user's activities from the feed.

---

## 30. Nutrition Requirements

Nutrition features support:

- Calories
- Protein
- Carbohydrates
- Fat
- Fiber
- Optional future nutrients

The nutrition system is private by default.

---

## 31. Calorie Calculator

Inputs:

- Age
- Sex
- Height
- Weight
- Activity level
- Goal

Outputs:

- BMR
- TDEE
- Calorie target
- Macro targets

---

## 32. BMR

Default formula: Mifflin-St Jeor.

Male:

```text
BMR = 10W + 6.25H - 5A + 5
```

Female:

```text
BMR = 10W + 6.25H - 5A - 161
```

Where:

- W = kg
- H = cm
- A = age

---

## 33. Activity Multipliers

| Level | Multiplier |
|---|---:|
| Sedentary | 1.20 |
| Lightly Active | 1.375 |
| Moderately Active | 1.55 |
| Very Active | 1.725 |
| Extremely Active | 1.90 |

---

## 34. TDEE and Goal Calories

```text
TDEE = BMR × Activity Multiplier
```

Goal modes:

- Weight loss = TDEE - deficit
- Maintenance = TDEE
- Weight gain = TDEE + surplus

The target is an estimate and the user may override it.

---

## 35. Macro Targets

Track:

- Protein
- Carbohydrates
- Fat

Standard calorie conversion:

```text
Protein = 4 kcal/g
Carbs = 4 kcal/g
Fat = 9 kcal/g
```

Fiber is tracked separately.

---

## 36. Food Logging

Users can add food through:

1. Search
2. Manual entry
3. Camera
4. Image upload

A nutrition entry supports:

- Food
- Quantity
- Unit
- Calories
- Protein
- Carbs
- Fat
- Fiber
- Meal
- Time

---

## 37. Meal Categories

Default:

- Breakfast
- Lunch
- Dinner
- Snack
- Pre-Workout
- Post-Workout
- Other

Custom meal names are allowed.

---

## 38. AI Food Recognition

AI food scanning flow:

```text
Add Food
    ↓
Take Photo / Upload
    ↓
Image Analysis
    ↓
Detected Foods
    ↓
Estimated Portions
    ↓
Nutrition Resolution
    ↓
Confidence
    ↓
User Review
    ↓
Edit
    ↓
Confirm
    ↓
Save
```

The AI must never create a final nutrition record without user confirmation.

---

## 39. AI Output

For each detected item:

- Food name
- Estimated quantity
- Estimated unit
- Calories
- Protein
- Carbs
- Fat
- Fiber
- Optional confidence

Example:

```text
Chicken
150 g
248 kcal
P 46g
C 0g
F 5g
Fiber 0g
Confidence 91%
```

---

## 40. AI Review

User must be able to:

- Change food
- Change portion
- Change unit
- Edit nutrition
- Remove item
- Add missing item

---

## 41. AI Limitations

The application must explain that image nutrition estimation is especially uncertain for:

- Oil
- Sauces
- Mixed dishes
- Restaurant meals
- Hidden ingredients
- Portion size
- Visually similar foods

---

## 42. Camera

The mobile web experience should support native browser camera capture where available.

Fallback:

- Image file upload

---

## 43. Nutrition Dashboard

Example:

```text
Calories
1,860 / 2,400 kcal

Protein
142 / 170 g

Carbs
210 / 270 g

Fat
55 / 70 g

Fiber
24 / 30 g
```

---

## 44. Nutrition Sharing

Nutrition remains private unless the user explicitly shares it.

Optional share card:

```text
Today's Nutrition

2,410 kcal
170g Protein
250g Carbs
70g Fat
31g Fiber
```

---

## 45. Weight Tracking

Users can record:

- Weight
- Date/time
- Optional notes

Weight is private by default.

---

## 46. Body Measurements

Optional:

- Waist
- Chest
- Arm
- Forearm
- Thigh
- Calf
- Hips
- Neck
- Custom

Private by default.

---

## 47. Progress Photos

Optional and private by default.

Types:

- Front
- Side
- Back
- Custom

---

## 48. Progress Analytics

Required:

- Weight trend
- Strength trend
- Estimated 1RM trend
- Training volume
- Workout frequency
- Nutrition averages
- PR history
- Goal progress
- Streaks

---

## 49. Calendar

Calendar can show:

- Workouts
- Published activities
- Nutrition days
- Weight logs
- Planned workouts

---

## 50. Athlete Profile Statistics

Potential public statistics:

- Activities
- Training time
- Total volume
- PR count
- Streak
- Achievements

Each statistic can be controlled by privacy settings.

---

## 51. Public Activity URLs

Every public activity gets a shareable URL.

Example:

`/a/abc123`

The page may expose Open Graph metadata for sharing.

---

## 52. Data Export

Users can export:

- Profile
- Activities
- Workouts
- Sets
- Nutrition
- Food scans
- Weight
- Measurements
- Goals
- PRs

Formats:

- CSV
- JSON

---

## 53. Account Deletion

Account deletion must:

- Require confirmation
- Revoke sessions
- Remove/anonymize personal data according to retention rules
- Remove private media
- Handle public content according to the deletion policy

---

## 54. Mobile Requirements

Critical workflows must be usable on mobile:

- Feed
- Activity viewing
- Start workout
- Log set
- Rest timer
- Food camera
- Food review
- Nutrition entry
- Notifications

---

## 55. Non-Goals

This product does not include:

- Gym branch management
- Membership management
- Staff management
- Commercial billing
- POS
- Gym inventory
- Gym equipment maintenance
- Payroll
- Gym class administration

---

## 56. Product Success Metrics

### Social

- Weekly active athletes
- Activities published
- Followers per active user
- Comments per activity
- Likes per activity
- Retention

### Fitness

- Workouts recorded
- Completed workouts
- PRs achieved
- Weekly training frequency

### Nutrition

- Nutrition logs
- Food scans
- Scan confirmation rate
- Daily logging retention

---

## 57. High-Level User Journey

```text
Register
  ↓
Build Profile
  ↓
Set Goal
  ↓
Calculate Calories
  ↓
Follow Athletes
  ↓
Start Workout
  ↓
Log Sets
  ↓
Complete Workout
  ↓
See Stats / PRs
  ↓
Publish Activity
  ↓
Receive Social Engagement
  ↓
Log Food
  ↓
Scan Food With Camera
  ↓
Review AI Estimate
  ↓
Save Nutrition
  ↓
Monitor Progress
```

---

## 58. Final Product Definition

The product is a **social fitness network for gym training**, where:

- workouts become shareable activities,
- fitness progress builds an athlete profile,
- social interaction is tied to actual training,
- and nutrition tracking—including AI-assisted food recognition—lives inside the same fitness identity.

---
