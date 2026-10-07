import { z } from "zod";
import { route, json, noContent, parseBody } from "@/server/http/handler";
import { optionalText, uuid } from "@/lib/validators/common";
import { saveWorkoutSchema } from "@/lib/validators/workout";
import { deleteWorkout, getWorkout, saveWorkout, updateWorkoutMeta } from "@/server/services/workouts";

export const GET = route.auth(async ({ user, params }) => json(await getWorkout(user.id, uuid.parse(params.id), { withPrevious: true })));
/** Autosave: full-state replace, idempotent. */
export const PUT = route.auth(async ({ req, user, params }) => json(await saveWorkout(user, uuid.parse(params.id), await parseBody(req, saveWorkoutSchema))));
export const PATCH = route.auth(async ({ req, user, params }) => {
  const patch = await parseBody(req, z.object({ title: z.string().trim().min(1).max(120).optional(), notes: optionalText(2000).optional() }));
  await updateWorkoutMeta(user.id, uuid.parse(params.id), { ...(patch.title !== undefined ? { title: patch.title } : {}), ...(patch.notes !== undefined ? { notes: patch.notes } : {}) });
  return noContent();
});
export const DELETE = route.auth(async ({ user, params }) => {
  await deleteWorkout(user.id, uuid.parse(params.id));
  return noContent();
});
