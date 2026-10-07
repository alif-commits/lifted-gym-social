import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Column helpers                                                             */
/* -------------------------------------------------------------------------- */

const pk = () => uuid("id").primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () =>
  ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const num = (name: string) => numeric(name, { mode: "number" });

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: pk(),
    email: varchar("email", { length: 320 }).notNull(),
    username: varchar("username", { length: 30 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: varchar("display_name", { length: 80 }).notNull(),
    avatarKey: text("avatar_key"),
    googleSub: varchar("google_sub", { length: 64 }),
    status: varchar("status", { length: 16 }).notNull().default("active"), // active | suspended | deleted
    role: varchar("role", { length: 16 }).notNull().default("user"), // user | moderator | admin
    emailVerifiedAt: ts("email_verified_at"),
    usernameChangedAt: ts("username_changed_at"),
    deletedAt: ts("deleted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    uniqueIndex("users_username_uq").on(t.username),
    uniqueIndex("users_google_sub_uq").on(t.googleSub),
    index("users_status_idx").on(t.status),
    index("users_created_at_idx").on(t.createdAt),
    index("users_username_trgm_idx").using("gin", sql`${t.username} gin_trgm_ops`),
    index("users_display_name_trgm_idx").using("gin", sql`${t.displayName} gin_trgm_ops`),
  ],
);

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  dateOfBirth: date("date_of_birth"),
  sex: varchar("sex", { length: 16 }),
  heightCm: num("height_cm"),
  activityLevel: varchar("activity_level", { length: 24 }),
  trainingExperience: varchar("training_experience", { length: 24 }),
  fitnessGoal: varchar("fitness_goal", { length: 24 }),
  bio: text("bio"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 8 }).notNull().default("en"),
  timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
  unitSystem: varchar("unit_system", { length: 12 }).notNull().default("metric"),
  isPrivateAccount: boolean("is_private_account").notNull().default(false),
  defaultActivityVisibility: varchar("default_activity_visibility", { length: 16 }).notNull().default("PUBLIC"),
  nutritionVisibility: varchar("nutrition_visibility", { length: 16 }).notNull().default("ONLY_ME"),
  weightVisibility: varchar("weight_visibility", { length: 16 }).notNull().default("ONLY_ME"),
  measurementVisibility: varchar("measurement_visibility", { length: 16 }).notNull().default("ONLY_ME"),
  notificationSettings: jsonb("notification_settings").notNull().default({}),
  privacySettings: jsonb("privacy_settings").notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    userAgent: text("user_agent"),
    ip: varchar("ip", { length: 64 }),
    createdAt: createdAt(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
  },
  (t) => [uniqueIndex("sessions_token_hash_uq").on(t.tokenHash), index("sessions_user_idx").on(t.userId)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 24 }).notNull(), // EMAIL_VERIFY | PASSWORD_RESET
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("auth_tokens_hash_uq").on(t.tokenHash), index("auth_tokens_user_idx").on(t.userId, t.type)],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: varchar("key", { length: 200 }).notNull(),
    windowStart: ts("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

/* -------------------------------------------------------------------------- */
/* Social graph                                                               */
/* -------------------------------------------------------------------------- */

export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followedId: uuid("followed_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followedId] }),
    index("follows_followed_idx").on(t.followedId),
    index("follows_follower_idx").on(t.followerId),
    check("follows_no_self", sql`${t.followerId} <> ${t.followedId}`),
  ],
);

export const followRequests = pgTable(
  "follow_requests",
  {
    id: pk(),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 12 }).notNull().default("PENDING"), // PENDING | ACCEPTED | REJECTED
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("follow_requests_pending_uq")
      .on(t.requesterId, t.targetId)
      .where(sql`${t.status} = 'PENDING'`),
    index("follow_requests_target_idx").on(t.targetId, t.status),
  ],
);

export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] }), index("blocks_blocked_idx").on(t.blockedId)],
);

export const mutes = pgTable(
  "mutes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mutedUserId: uuid("muted_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.mutedUserId] })],
);

/* -------------------------------------------------------------------------- */
/* Exercises & workouts                                                       */
/* -------------------------------------------------------------------------- */

export const exercises = pgTable(
  "exercises",
  {
    id: pk(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    instructions: text("instructions"),
    primaryMuscleGroup: varchar("primary_muscle_group", { length: 32 }).notNull(),
    secondaryMuscles: jsonb("secondary_muscles").$type<string[]>().notNull().default([]),
    equipment: varchar("equipment", { length: 32 }).notNull().default("OTHER"),
    exerciseType: varchar("exercise_type", { length: 24 }).notNull().default("STRENGTH"), // STRENGTH | BODYWEIGHT | TIMED | CARDIO
    trackingMode: varchar("tracking_mode", { length: 24 }).notNull().default("WEIGHT_REPS"),
    difficulty: varchar("difficulty", { length: 16 }).notNull().default("INTERMEDIATE"),
    mediaUrl: text("media_url"),
    setupInstructions: text("setup_instructions"),
    executionSteps: jsonb("execution_steps").$type<string[]>().notNull().default([]),
    breathingNotes: text("breathing_notes"),
    commonMistakes: jsonb("common_mistakes").$type<string[]>().notNull().default([]),
    isGlobal: boolean("is_global").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("exercises_owner_idx").on(t.ownerUserId),
    index("exercises_muscle_idx").on(t.primaryMuscleGroup),
    index("exercises_name_trgm_idx").using("gin", sql`${t.name} gin_trgm_ops`),
  ],
);

export const exerciseMedia = pgTable(
  "exercise_media",
  {
    id: pk(),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    mediaType: varchar("media_type", { length: 16 }).notNull(), // IMAGE | GIF | VIDEO
    sourceUrl: text("source_url"),
    storageKey: text("storage_key"),
    license: varchar("license", { length: 80 }),
    attribution: text("attribution"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("exercise_media_exercise_idx").on(t.exerciseId)],
);

export const externalConnections = pgTable(
  "external_connections",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 24 }).notNull(), // STRAVA
    externalUserId: varchar("external_user_id", { length: 64 }).notNull(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    tokenExpiresAt: ts("token_expires_at").notNull(),
    scope: text("scope"),
    athleteName: varchar("athlete_name", { length: 120 }),
    lastSyncedAt: ts("last_synced_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("external_connections_user_provider_uq").on(t.userId, t.provider), index("external_connections_provider_ext_idx").on(t.provider, t.externalUserId)],
);

export const externalActivities = pgTable(
  "external_activities",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 24 }).notNull(),
    externalActivityId: varchar("external_activity_id", { length: 64 }).notNull(),
    workoutId: uuid("workout_id").references(() => workouts.id, { onDelete: "set null" }),
    importedAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("external_activities_provider_ext_user_uq").on(t.provider, t.externalActivityId, t.userId)],
);

export const workoutTemplates = pgTable(
  "workout_templates",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("workout_templates_user_idx").on(t.userId)],
);

export const workoutTemplateExercises = pgTable(
  "workout_template_exercises",
  {
    id: pk(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id),
    orderIndex: integer("order_index").notNull(),
    targetSets: integer("target_sets"),
    targetReps: varchar("target_reps", { length: 24 }),
    targetWeight: num("target_weight"),
    restSeconds: integer("rest_seconds"),
    notes: text("notes"),
  },
  (t) => [unique("workout_template_exercises_order_uq").on(t.templateId, t.orderIndex)],
);

export const programs = pgTable(
  "programs",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("programs_user_idx").on(t.userId)],
);

export const programWeeks = pgTable(
  "program_weeks",
  {
    id: pk(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    weekNumber: integer("week_number").notNull(),
    name: varchar("name", { length: 80 }),
  },
  (t) => [unique("program_weeks_uq").on(t.programId, t.weekNumber)],
);

export const programDays = pgTable(
  "program_days",
  {
    id: pk(),
    programWeekId: uuid("program_week_id")
      .notNull()
      .references(() => programWeeks.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    notes: text("notes"),
  },
  (t) => [unique("program_days_uq").on(t.programWeekId, t.dayNumber)],
);

export const programExercises = pgTable(
  "program_exercises",
  {
    id: pk(),
    programDayId: uuid("program_day_id")
      .notNull()
      .references(() => programDays.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id),
    orderIndex: integer("order_index").notNull(),
    targetSets: integer("target_sets").notNull().default(3),
    targetReps: varchar("target_reps", { length: 24 }).notNull().default("8-12"),
    targetWeight: num("target_weight"),
    notes: text("notes"),
  },
  (t) => [unique("program_exercises_order_uq").on(t.programDayId, t.orderIndex)],
);

export const programAssignments = pgTable(
  "program_assignments",
  {
    id: pk(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    status: varchar("status", { length: 12 }).notNull().default("ACTIVE"), // ACTIVE | COMPLETED | CANCELLED
  },
  (t) => [index("program_assignments_user_idx").on(t.userId, t.status)],
);

export const workouts = pgTable(
  "workouts",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => workoutTemplates.id, { onDelete: "set null" }),
    programDayId: uuid("program_day_id").references(() => programDays.id, { onDelete: "set null" }),
    title: varchar("title", { length: 120 }).notNull(),
    status: varchar("status", { length: 12 }).notNull().default("ACTIVE"), // ACTIVE | COMPLETED
    startedAt: ts("started_at").notNull().defaultNow(),
    completedAt: ts("completed_at"),
    durationSeconds: integer("duration_seconds"),
    notes: text("notes"),
    // Server-authoritative statistics (set on completion)
    volume: num("volume"),
    exerciseCount: integer("exercise_count"),
    setCount: integer("set_count"),
    repCount: integer("rep_count"),
    prCount: integer("pr_count"),
    caloriesBurnedEstimate: num("calories_burned_estimate"),
    source: varchar("source", { length: 16 }).notNull().default("LIFTED"), // LIFTED | STRAVA
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("workouts_user_started_idx").on(t.userId, t.startedAt),
    index("workouts_user_status_idx").on(t.userId, t.status),
    // Only one ACTIVE workout per user
    uniqueIndex("workouts_one_active_uq")
      .on(t.userId)
      .where(sql`${t.status} = 'ACTIVE'`),
  ],
);

export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id: pk(),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id),
    orderIndex: integer("order_index").notNull(),
    notes: text("notes"),
    restSeconds: integer("rest_seconds"),
    createdAt: createdAt(),
  },
  (t) => [
    unique("workout_exercises_order_uq").on(t.workoutId, t.orderIndex),
    index("workout_exercises_workout_idx").on(t.workoutId),
    index("workout_exercises_exercise_idx").on(t.exerciseId),
  ],
);

export const workoutSets = pgTable(
  "workout_sets",
  {
    id: pk(),
    workoutExerciseId: uuid("workout_exercise_id")
      .notNull()
      .references(() => workoutExercises.id, { onDelete: "cascade" }),
    setNumber: integer("set_number").notNull(),
    setType: varchar("set_type", { length: 12 }).notNull().default("NORMAL"), // NORMAL | WARMUP | DROP | FAILURE
    weight: num("weight"),
    reps: integer("reps"),
    durationSeconds: integer("duration_seconds"),
    distance: num("distance"),
    rpe: num("rpe"),
    rir: num("rir"),
    completed: boolean("completed").notNull().default(false),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("workout_sets_we_idx").on(t.workoutExerciseId)],
);

export const fitnessGoals = pgTable(
  "fitness_goals",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    goalType: varchar("goal_type", { length: 24 }).notNull(), // BODY_WEIGHT | EXERCISE_1RM | WORKOUT_FREQUENCY | CUSTOM
    exerciseId: uuid("exercise_id").references(() => exercises.id, { onDelete: "set null" }),
    targetValue: num("target_value"),
    targetUnit: varchar("target_unit", { length: 16 }),
    startValue: num("start_value"),
    startDate: date("start_date").notNull(),
    targetDate: date("target_date"),
    status: varchar("status", { length: 12 }).notNull().default("ACTIVE"), // ACTIVE | ACHIEVED | ABANDONED
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("fitness_goals_user_idx").on(t.userId, t.status)],
);

export const personalRecords = pgTable(
  "personal_records",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id").references(() => exercises.id, { onDelete: "cascade" }),
    workoutId: uuid("workout_id").references(() => workouts.id, { onDelete: "cascade" }),
    recordType: varchar("record_type", { length: 24 }).notNull(),
    value: num("value").notNull(),
    previousValue: num("previous_value"),
    unit: varchar("unit", { length: 16 }).notNull(),
    achievedAt: ts("achieved_at").notNull(),
  },
  (t) => [
    index("personal_records_lookup_idx").on(t.userId, t.exerciseId, t.recordType),
    index("personal_records_achieved_idx").on(t.userId, t.achievedAt),
    index("personal_records_workout_idx").on(t.workoutId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Activities & engagement                                                    */
/* -------------------------------------------------------------------------- */

export type ActivitySummaryItem = {
  exerciseId: string;
  name: string;
  sets: number;
  best: { weight: number | null; reps: number | null; durationSeconds: number | null; distance: number | null };
};

export const activities = pgTable(
  "activities",
  {
    id: pk(),
    shortId: varchar("short_id", { length: 12 }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workoutId: uuid("workout_id").references(() => workouts.id, { onDelete: "set null" }),
    status: varchar("status", { length: 12 }).notNull().default("DRAFT"), // DRAFT | PUBLISHED
    title: varchar("title", { length: 120 }).notNull(),
    description: text("description"),
    activityType: varchar("activity_type", { length: 24 }).notNull().default("STRENGTH"),
    visibility: varchar("visibility", { length: 16 }).notNull().default("PUBLIC"), // PUBLIC | FOLLOWERS | ONLY_ME
    showExerciseDetails: boolean("show_exercise_details").notNull().default(true),
    startedAt: ts("started_at").notNull(),
    endedAt: ts("ended_at"),
    durationSeconds: integer("duration_seconds"),
    volume: num("volume"),
    exerciseCount: integer("exercise_count").notNull().default(0),
    setCount: integer("set_count").notNull().default(0),
    repCount: integer("rep_count").notNull().default(0),
    prCount: integer("pr_count").notNull().default(0),
    caloriesBurnedEstimate: num("calories_burned_estimate"),
    summary: jsonb("summary").$type<ActivitySummaryItem[]>().notNull().default([]),
    locationName: varchar("location_name", { length: 120 }),
    publishedAt: ts("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("activities_short_id_uq").on(t.shortId),
    // One workout may publish to at most one activity
    uniqueIndex("activities_workout_uq").on(t.workoutId),
    index("activities_user_published_idx").on(t.userId, t.publishedAt),
    index("activities_visibility_published_idx").on(t.visibility, t.publishedAt),
    index("activities_status_published_idx").on(t.status, t.publishedAt),
  ],
);

export const activityPhotos = pgTable(
  "activity_photos",
  {
    id: pk(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    thumbnailKey: text("thumbnail_key").notNull(),
    mimeType: varchar("mime_type", { length: 64 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("activity_photos_activity_idx").on(t.activityId, t.sortOrder)],
);

export const hashtags = pgTable(
  "hashtags",
  {
    id: pk(),
    tag: varchar("tag", { length: 50 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("hashtags_tag_uq").on(t.tag), index("hashtags_tag_trgm_idx").using("gin", sql`${t.tag} gin_trgm_ops`)],
);

export const activityHashtags = pgTable(
  "activity_hashtags",
  {
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    hashtagId: uuid("hashtag_id")
      .notNull()
      .references(() => hashtags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.activityId, t.hashtagId] }), index("activity_hashtags_tag_idx").on(t.hashtagId)],
);

export const likes = pgTable(
  "likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.activityId] }), index("likes_activity_idx").on(t.activityId)],
);

export const comments = pgTable(
  "comments",
  {
    id: pk(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentCommentId: uuid("parent_comment_id").references((): AnyPgColumn => comments.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("comments_activity_idx").on(t.activityId, t.createdAt), index("comments_parent_idx").on(t.parentCommentId)],
);

export const commentLikes = pgTable(
  "comment_likes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.commentId] }), index("comment_likes_comment_idx").on(t.commentId)],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.activityId] })],
);

export const mentions = pgTable(
  "mentions",
  {
    id: pk(),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contextType: varchar("context_type", { length: 16 }).notNull(), // ACTIVITY | COMMENT
    contextId: uuid("context_id"),
    createdAt: createdAt(),
  },
  (t) => [index("mentions_user_idx").on(t.userId), index("mentions_activity_idx").on(t.activityId)],
);

/* -------------------------------------------------------------------------- */
/* Nutrition                                                                  */
/* -------------------------------------------------------------------------- */

export const calorieCalculations = pgTable(
  "calorie_calculations",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    formula: varchar("formula", { length: 24 }).notNull(),
    age: integer("age").notNull(),
    sex: varchar("sex", { length: 16 }).notNull(),
    heightCm: num("height_cm").notNull(),
    weightKg: num("weight_kg").notNull(),
    activityLevel: varchar("activity_level", { length: 24 }).notNull(),
    bmr: num("bmr").notNull(),
    tdee: num("tdee").notNull(),
    goal: varchar("goal", { length: 16 }).notNull(),
    adjustment: num("adjustment").notNull(),
    targetCalories: num("target_calories").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("calorie_calculations_user_idx").on(t.userId, t.createdAt)],
);

export const calorieGoals = pgTable(
  "calorie_goals",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    calorieTarget: num("calorie_target").notNull(),
    proteinTargetG: num("protein_target_g").notNull(),
    carbsTargetG: num("carbs_target_g").notNull(),
    fatTargetG: num("fat_target_g").notNull(),
    fiberTargetG: num("fiber_target_g"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    source: varchar("source", { length: 16 }).notNull().default("CALCULATOR"), // CALCULATOR | MANUAL
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index("calorie_goals_user_idx").on(t.userId, t.active),
    uniqueIndex("calorie_goals_one_active_uq")
      .on(t.userId)
      .where(sql`${t.active} = true`),
  ],
);

export const foodItems = pgTable(
  "food_items",
  {
    id: pk(),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    brand: varchar("brand", { length: 120 }),
    servingSize: num("serving_size").notNull().default(100),
    servingUnit: varchar("serving_unit", { length: 16 }).notNull().default("g"),
    calories: num("calories").notNull(),
    proteinG: num("protein_g").notNull(),
    carbsG: num("carbs_g").notNull(),
    fatG: num("fat_g").notNull(),
    fiberG: num("fiber_g"),
    barcode: varchar("barcode", { length: 64 }),
    source: varchar("source", { length: 16 }).notNull().default("USER"), // SEED | USER | AI
    verified: boolean("verified").notNull().default(false),
    isGlobal: boolean("is_global").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("food_items_name_idx").on(t.name),
    index("food_items_name_trgm_idx").using("gin", sql`${t.name} gin_trgm_ops`),
    index("food_items_barcode_idx").on(t.barcode),
    index("food_items_owner_idx").on(t.ownerUserId),
  ],
);

export const meals = pgTable(
  "meals",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 60 }).notNull(),
    consumedAt: ts("consumed_at").notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("meals_user_consumed_idx").on(t.userId, t.consumedAt)],
);

export const foodScans = pgTable(
  "food_scans",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    mimeType: varchar("mime_type", { length: 64 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("PROCESSING"), // UPLOADING | PROCESSING | COMPLETED | FAILED | CANCELLED | CONFIRMED
    provider: varchar("provider", { length: 32 }).notNull(),
    model: varchar("model", { length: 80 }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    errorCode: varchar("error_code", { length: 48 }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    completedAt: ts("completed_at"),
    confirmedAt: ts("confirmed_at"),
  },
  (t) => [index("food_scans_user_idx").on(t.userId, t.createdAt), index("food_scans_hash_idx").on(t.userId, t.contentHash)],
);

export const foodScanItems = pgTable(
  "food_scan_items",
  {
    id: pk(),
    foodScanId: uuid("food_scan_id")
      .notNull()
      .references(() => foodScans.id, { onDelete: "cascade" }),
    recognizedName: varchar("recognized_name", { length: 160 }).notNull(),
    matchedFoodId: uuid("matched_food_id").references(() => foodItems.id, { onDelete: "set null" }),
    estimatedQuantity: num("estimated_quantity"),
    estimatedUnit: varchar("estimated_unit", { length: 16 }),
    calories: num("calories"),
    proteinG: num("protein_g"),
    carbsG: num("carbs_g"),
    fatG: num("fat_g"),
    fiberG: num("fiber_g"),
    visionConfidence: num("vision_confidence"),
    foodMatchConfidence: num("food_match_confidence"),
    portionConfidence: num("portion_confidence"),
    confidence: num("confidence"),
    source: varchar("source", { length: 8 }).notNull().default("AI"), // AI | USER
    userConfirmed: boolean("user_confirmed").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("food_scan_items_scan_idx").on(t.foodScanId)],
);

export const nutritionEntries = pgTable(
  "nutrition_entries",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mealId: uuid("meal_id").references(() => meals.id, { onDelete: "set null" }),
    foodItemId: uuid("food_item_id").references(() => foodItems.id, { onDelete: "set null" }),
    // Idempotency: a scan item can only be converted into a nutrition entry once
    foodScanItemId: uuid("food_scan_item_id").references(() => foodScanItems.id, { onDelete: "set null" }),
    source: varchar("source", { length: 16 }).notNull(), // SEARCH | MANUAL | AI_SCAN
    foodName: varchar("food_name", { length: 160 }).notNull(),
    quantity: num("quantity").notNull(),
    unit: varchar("unit", { length: 16 }).notNull(),
    calories: num("calories").notNull(),
    proteinG: num("protein_g").notNull(),
    carbsG: num("carbs_g").notNull(),
    fatG: num("fat_g").notNull(),
    fiberG: num("fiber_g"),
    consumedAt: ts("consumed_at").notNull(),
    confidenceScore: num("confidence_score"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("nutrition_entries_user_consumed_idx").on(t.userId, t.consumedAt),
    uniqueIndex("nutrition_entries_scan_item_uq").on(t.foodScanItemId),
  ],
);

export const nutritionShareCards = pgTable(
  "nutrition_share_cards",
  {
    id: pk(),
    shortId: varchar("short_id", { length: 12 }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    metrics: jsonb("metrics").$type<Record<string, number>>().notNull(),
    visibility: varchar("visibility", { length: 16 }).notNull().default("PUBLIC"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("nutrition_share_cards_short_uq").on(t.shortId), index("nutrition_share_cards_user_idx").on(t.userId)],
);

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */

export const weightRecords = pgTable(
  "weight_records",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weight: num("weight").notNull(),
    unit: varchar("unit", { length: 8 }).notNull().default("kg"),
    recordedAt: ts("recorded_at").notNull(),
    source: varchar("source", { length: 16 }).notNull().default("MANUAL"),
    notes: text("notes"),
  },
  (t) => [index("weight_records_user_idx").on(t.userId, t.recordedAt)],
);

export const bodyMeasurements = pgTable(
  "body_measurements",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    measurementType: varchar("measurement_type", { length: 32 }).notNull(),
    value: num("value").notNull(),
    unit: varchar("unit", { length: 8 }).notNull().default("cm"),
    recordedAt: ts("recorded_at").notNull(),
    notes: text("notes"),
  },
  (t) => [index("body_measurements_user_idx").on(t.userId, t.recordedAt)],
);

export const progressPhotos = pgTable(
  "progress_photos",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    photoType: varchar("photo_type", { length: 12 }).notNull(), // FRONT | SIDE | BACK | CUSTOM
    storageKey: text("storage_key").notNull(),
    thumbnailKey: text("thumbnail_key").notNull(),
    recordedAt: ts("recorded_at").notNull(),
    notes: text("notes"),
  },
  (t) => [index("progress_photos_user_idx").on(t.userId, t.recordedAt)],
);

/* -------------------------------------------------------------------------- */
/* Notifications, moderation, ops                                             */
/* -------------------------------------------------------------------------- */

export const notifications = pgTable(
  "notifications",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 24 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    message: text("message").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_created_idx").on(t.userId, sql`${t.createdAt} desc`)],
);

export const reports = pgTable(
  "reports",
  {
    id: pk(),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: varchar("target_type", { length: 16 }).notNull(), // PROFILE | ACTIVITY | COMMENT | IMAGE
    targetId: uuid("target_id").notNull(),
    reason: varchar("reason", { length: 24 }).notNull(),
    details: text("details"),
    status: varchar("status", { length: 12 }).notNull().default("OPEN"), // OPEN | RESOLVED | DISMISSED
    createdAt: createdAt(),
    resolvedAt: ts("resolved_at"),
  },
  (t) => [index("reports_status_idx").on(t.status, t.createdAt)],
);

export const moderationActions = pgTable("moderation_actions", {
  id: pk(),
  moderatorUserId: uuid("moderator_user_id")
    .notNull()
    .references(() => users.id),
  reportId: uuid("report_id").references(() => reports.id, { onDelete: "set null" }),
  targetType: varchar("target_type", { length: 16 }).notNull(),
  targetId: uuid("target_id").notNull(),
  action: varchar("action", { length: 24 }).notNull(),
  reason: text("reason"),
  createdAt: createdAt(),
});

/** Singleton (id = 1). Public site switches controlled from the admin console. */
export const siteSettings = pgTable(
  "site_settings",
  {
    id: integer("id").primaryKey().default(1),
    siteName: varchar("site_name", { length: 40 }).notNull().default("LIFTED"),
    tagline: varchar("tagline", { length: 120 }).notNull().default("Log workouts, track nutrition, share progress."),
    supportEmail: varchar("support_email", { length: 320 }),
    registrationOpen: boolean("registration_open").notNull().default(true),
    googleSignupOpen: boolean("google_signup_open").notNull().default(true),
    maintenanceMode: boolean("maintenance_mode").notNull().default(false),
    announcement: varchar("announcement", { length: 240 }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: updatedAt(),
  },
  (t) => [check("site_settings_singleton", sql`${t.id} = 1`)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: pk(),
    userId: uuid("user_id"),
    action: varchar("action", { length: 48 }).notNull(),
    entityType: varchar("entity_type", { length: 32 }).notNull(),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_user_idx").on(t.userId, t.createdAt)],
);

export const dataExports = pgTable(
  "data_exports",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    format: varchar("format", { length: 8 }).notNull(), // JSON | CSV
    status: varchar("status", { length: 12 }).notNull().default("PENDING"), // PENDING | READY | FAILED
    storageKey: text("storage_key"),
    sizeBytes: integer("size_bytes"),
    errorCode: varchar("error_code", { length: 48 }),
    expiresAt: ts("expires_at"),
    createdAt: createdAt(),
    completedAt: ts("completed_at"),
  },
  (t) => [index("data_exports_user_idx").on(t.userId, t.createdAt)],
);
