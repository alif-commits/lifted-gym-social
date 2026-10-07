/** Domain enumerations shared by API validation, database seeds and UI. */

export const MUSCLE_GROUPS = [
  "CHEST",
  "BACK",
  "SHOULDERS",
  "BICEPS",
  "TRICEPS",
  "FOREARMS",
  "QUADS",
  "HAMSTRINGS",
  "GLUTES",
  "CALVES",
  "CORE",
  "FULL_BODY",
  "CARDIO",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  "BARBELL",
  "DUMBBELL",
  "MACHINE",
  "CABLE",
  "BODYWEIGHT",
  "KETTLEBELL",
  "BAND",
  "SMITH_MACHINE",
  "CARDIO_MACHINE",
  "OTHER",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EXERCISE_TYPES = ["STRENGTH", "BODYWEIGHT", "TIMED", "CARDIO"] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const TRACKING_MODES = ["WEIGHT_REPS", "BODYWEIGHT_REPS", "DURATION", "DISTANCE_DURATION"] as const;
export type TrackingMode = (typeof TRACKING_MODES)[number];

export const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

export const SET_TYPES = ["NORMAL", "WARMUP", "DROP", "FAILURE"] as const;
export type SetType = (typeof SET_TYPES)[number];

export const VISIBILITIES = ["PUBLIC", "FOLLOWERS", "ONLY_ME"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** Nutrition/weight/measurement visibility is restricted: private by default, optionally followers. */
export const DATA_VISIBILITIES = ["ONLY_ME", "FOLLOWERS", "PUBLIC"] as const;

export const SEX_OPTIONS = ["MALE", "FEMALE"] as const;
export type Sex = (typeof SEX_OPTIONS)[number];

export const ACTIVITY_LEVELS = ["SEDENTARY", "LIGHT", "MODERATE", "VERY_ACTIVE", "EXTREME"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  SEDENTARY: 1.2,
  LIGHT: 1.375,
  MODERATE: 1.55,
  VERY_ACTIVE: 1.725,
  EXTREME: 1.9,
};

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  SEDENTARY: "Sedentary",
  LIGHT: "Lightly active",
  MODERATE: "Moderately active",
  VERY_ACTIVE: "Very active",
  EXTREME: "Extremely active",
};

export const NUTRITION_GOALS = ["LOSE", "MAINTAIN", "GAIN"] as const;
export type NutritionGoal = (typeof NUTRITION_GOALS)[number];

export const FITNESS_GOALS = ["LOSE_FAT", "BUILD_MUSCLE", "STRENGTH", "ENDURANCE", "GENERAL_FITNESS"] as const;
export const TRAINING_EXPERIENCE = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;

export const GOAL_TYPES = ["BODY_WEIGHT", "EXERCISE_1RM", "WORKOUT_FREQUENCY", "CUSTOM"] as const;

export const DEFAULT_MEALS = ["Breakfast", "Lunch", "Dinner", "Snack", "Pre-Workout", "Post-Workout", "Other"] as const;

export const FOOD_UNITS = ["g", "kg", "oz", "lb", "ml", "l", "cup", "tbsp", "tsp", "serving", "piece", "slice"] as const;
export type FoodUnit = (typeof FOOD_UNITS)[number];

export const MEASUREMENT_TYPES = [
  "WAIST",
  "CHEST",
  "ARM",
  "FOREARM",
  "THIGH",
  "CALF",
  "HIPS",
  "NECK",
  "CUSTOM",
] as const;

export const PROGRESS_PHOTO_TYPES = ["FRONT", "SIDE", "BACK", "CUSTOM"] as const;

export const REPORT_REASONS = ["SPAM", "HARASSMENT", "HATE", "SEXUAL", "DANGEROUS", "MISLEADING", "OTHER"] as const;
export const REPORT_TARGETS = ["PROFILE", "ACTIVITY", "COMMENT", "IMAGE"] as const;

export const RECORD_TYPES = [
  "MAX_WEIGHT",
  "ESTIMATED_1RM",
  "MAX_REPS",
  "EXERCISE_VOLUME",
  "MAX_DURATION",
  "MAX_DISTANCE",
] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  MAX_WEIGHT: "Heaviest weight",
  ESTIMATED_1RM: "Estimated 1RM",
  MAX_REPS: "Most reps",
  EXERCISE_VOLUME: "Best session volume",
  MAX_DURATION: "Longest duration",
  MAX_DISTANCE: "Longest distance",
};

export const NOTIFICATION_TYPES = [
  "NEW_FOLLOWER",
  "FOLLOW_REQUEST",
  "FOLLOW_ACCEPTED",
  "ACTIVITY_LIKE",
  "COMMENT",
  "COMMENT_REPLY",
  "MENTION",
  "PR",
  "GOAL_MILESTONE",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const ONE_RM_FORMULAS = ["EPLEY", "BRZYCKI", "LOMBARDI"] as const;
export type OneRepMaxFormula = (typeof ONE_RM_FORMULAS)[number];

export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
export const RESERVED_USERNAMES = new Set([
  "admin",
  "api",
  "app",
  "a",
  "u",
  "s",
  "login",
  "register",
  "settings",
  "support",
  "help",
  "explore",
  "feed",
  "lifted",
  "moderator",
  "root",
  "system",
]);
export const USERNAME_CHANGE_COOLDOWN_DAYS = 30;

export const MAX_ACTIVITY_PHOTOS = 6;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
