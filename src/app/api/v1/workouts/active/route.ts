import { route, json } from "@/server/http/handler";
import { getActiveWorkout } from "@/server/services/workouts";

export const GET = route.auth(async ({ user }) => json(await getActiveWorkout(user.id)));
