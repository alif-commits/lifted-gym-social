import { route, json, noContent, parseBody } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { goalUpdateSchema } from "@/lib/validators/progress";
import { deleteGoal, updateGoal } from "@/server/services/progress";

export const PATCH = route.auth(async ({ req, user, params }) => json(await updateGoal(user, uuid.parse(params.id), await parseBody(req, goalUpdateSchema))));
export const DELETE = route.auth(async ({ user, params }) => {
  await deleteGoal(user.id, uuid.parse(params.id));
  return noContent();
});
