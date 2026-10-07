import { route, json } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { listWorkoutPrs } from "@/server/services/workouts";

export const GET = route.auth(async ({ user, params }) => json(await listWorkoutPrs(user.id, uuid.parse(params.id))));
