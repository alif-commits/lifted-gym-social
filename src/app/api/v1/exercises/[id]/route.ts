import { route, json, noContent, parseBody } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { exerciseInputSchema } from "@/lib/validators/exercise";
import { deleteExercise, getExercise, updateExercise } from "@/server/services/exercises";

export const GET = route.auth(async ({ user, params }) => json(await getExercise(user, uuid.parse(params.id))));
export const PUT = route.auth(async ({ req, user, params }) => json(await updateExercise(user, uuid.parse(params.id), await parseBody(req, exerciseInputSchema))));
export const DELETE = route.auth(async ({ user, params }) => {
  await deleteExercise(user, uuid.parse(params.id));
  return noContent();
});
