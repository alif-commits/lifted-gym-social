import { route, json, parseQuery } from "@/server/http/handler";
import { paginationQuery } from "@/lib/validators/common";
import { bookmarkedActivities } from "@/server/services/feed";

export const GET = route.auth(async ({ req, user }) => {
  const q = parseQuery(req, paginationQuery);
  return json(await bookmarkedActivities(user, q.limit, q.cursor));
});
