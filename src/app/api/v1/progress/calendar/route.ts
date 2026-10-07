import { route, json, parseQuery } from "@/server/http/handler";
import { nutritionRangeQuery } from "@/lib/validators/nutrition";
import { getCalendar } from "@/server/services/progress";

export const GET = route.auth(async ({ req, user }) => {
  const q = parseQuery(req, nutritionRangeQuery);
  return json(await getCalendar(user, q.from, q.to));
});
