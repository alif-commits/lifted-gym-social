import { route, json, parseOptionalBody } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { completeWorkoutSchema } from "@/lib/validators/workout";
import { completeWorkout } from "@/server/services/workouts";

export const POST = route.auth(async ({ req, user, params }) => {
  const body = await parseOptionalBody(req, completeWorkoutSchema.optional());
  return json(await completeWorkout(user, uuid.parse(params.id), body));
});
