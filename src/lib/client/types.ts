/** Client-side views of server DTOs (dates are ISO strings on the wire). Type-only imports are erased from bundles. */
import type { MeDto } from "@/server/services/dto";
import type { UserSummaryDto } from "@/server/services/dto";
import type { ActivityCardDto, ActivityDetailDto } from "@/server/services/activities";
import type { CommentDto } from "@/server/services/engagement";
import type { ExerciseDto } from "@/server/services/exercises";
import type { WorkoutDto, WorkoutListItem } from "@/server/services/workouts";
import type { NotificationDto } from "@/server/services/notification-list";
import type { FoodScanDto } from "@/server/services/foodscan";
import type { Serialized } from "./api";

export type Me = Serialized<MeDto>;
export type UserSummary = Serialized<UserSummaryDto>;
export type ActivityCard = Serialized<ActivityCardDto>;
export type ActivityDetail = Serialized<ActivityDetailDto>;
export type CommentItem = Serialized<CommentDto>;
export type Exercise = Serialized<ExerciseDto>;
export type Workout = Serialized<WorkoutDto>;
export type WorkoutListEntry = Serialized<WorkoutListItem>;
export type NotificationItem = Serialized<NotificationDto>;
export type FoodScan = Serialized<FoodScanDto>;
