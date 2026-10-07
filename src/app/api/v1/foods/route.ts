import { route, json, created, parseBody, parseQuery } from "@/server/http/handler";
import { foodInputSchema, foodQuerySchema } from "@/lib/validators/nutrition";
import { createFood, searchFoods } from "@/server/services/nutrition";

export const GET = route.auth(async ({ req, user }) => {
  const q = parseQuery(req, foodQuerySchema);
  return json(await searchFoods(user, q.q, q.limit));
});
export const POST = route.auth(async ({ req, user }) => created(await createFood(user, await parseBody(req, foodInputSchema))));
