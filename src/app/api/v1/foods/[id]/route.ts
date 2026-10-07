import { route, json, noContent, parseBody } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { foodInputSchema } from "@/lib/validators/nutrition";
import { deleteFood, updateFood } from "@/server/services/nutrition";

export const PUT = route.auth(async ({ req, user, params }) => json(await updateFood(user, uuid.parse(params.id), await parseBody(req, foodInputSchema))));
export const DELETE = route.auth(async ({ user, params }) => {
  await deleteFood(user, uuid.parse(params.id));
  return noContent();
});
