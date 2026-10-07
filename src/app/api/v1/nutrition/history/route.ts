import { route, json, parseQuery } from "@/server/http/handler";
import { nutritionRangeQuery } from "@/lib/validators/nutrition";
import { history } from "@/server/services/nutrition";

export const GET = route.auth(async ({ req, user }) => {
  const q = parseQuery(req, nutritionRangeQuery);
  return json(await history(user, q.from, q.to));
});
