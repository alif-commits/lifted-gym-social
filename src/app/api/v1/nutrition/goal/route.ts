import { route, json, parseBody } from "@/server/http/handler";
import { calorieGoalSchema } from "@/lib/validators/nutrition";
import { getActiveGoal, goalDto, setGoal } from "@/server/services/nutrition";

export const GET = route.auth(async ({ user }) => json(goalDto(await getActiveGoal(user.id))));
export const PUT = route.auth(async ({ req, user }) => json(await setGoal(user, await parseBody(req, calorieGoalSchema))));
