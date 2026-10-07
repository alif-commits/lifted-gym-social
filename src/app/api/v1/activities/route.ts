import { route, created, parseBody } from "@/server/http/handler";
import { createActivitySchema } from "@/lib/validators/activity";
import { createDraftFromWorkout } from "@/server/services/activities";

/** Create (or return the existing) draft for a completed workout. */
export const POST = route.auth(async ({ req, user }) => created(await createDraftFromWorkout(user, (await parseBody(req, createActivitySchema)).workoutId)));
