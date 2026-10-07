import { route, json, parseQuery } from "@/server/http/handler";
import { paginationQuery } from "@/lib/validators/common";
import { hashtagActivities } from "@/server/services/feed";

export const GET = route.optional(async ({ req, user, params }) => {
  const q = parseQuery(req, paginationQuery);
  return json(await hashtagActivities(user, String(params.tag).replace(/^#/, "").toLowerCase(), q.limit, q.cursor));
});
