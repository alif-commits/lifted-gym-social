import { route, noContent } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { discardWorkout } from "@/server/services/workouts";

export const POST = route.auth(async ({ user, params }) => {
  await discardWorkout(user.id, uuid.parse(params.id));
  return noContent();
});
