import { route, json, parseQuery } from "@/server/http/handler";
import { paginationQuery } from "@/lib/validators/common";
import { listConnections } from "@/server/services/social";

export const GET = route.optional(async ({ req, user, params }) => {
  const q = parseQuery(req, paginationQuery);
  return json(await listConnections(user, String(params.username).toLowerCase(), "following", q.limit, q.cursor));
});
