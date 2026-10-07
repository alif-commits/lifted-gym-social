import { route, json, created, parseOptionalBody, parseQuery } from "@/server/http/handler";
import { paginationQuery } from "@/lib/validators/common";
import { startWorkoutSchema } from "@/lib/validators/workout";
import { listWorkouts, startWorkout } from "@/server/services/workouts";

export const GET = route.auth(async ({ req, user }) => {
  const q = parseQuery(req, paginationQuery);
  return json(await listWorkouts(user.id, q.limit, q.cursor));
});
export const POST = route.auth(async ({ req, user }) => {
  const body = await parseOptionalBody(req, startWorkoutSchema.optional().default({}));
  return created(await startWorkout(user, body));
});
