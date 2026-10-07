import { route, json, parseQuery } from "@/server/http/handler";
import { notFound } from "@/server/http/errors";
import { paginationQuery } from "@/lib/validators/common";
import { userActivities } from "@/server/services/feed";
import { findUserByUsername } from "@/server/services/users";

export const GET = route.optional(async ({ req, user, params }) => {
  const q = parseQuery(req, paginationQuery);
  const target = await findUserByUsername(String(params.username).toLowerCase());
  if (!target || target.user.status !== "active") throw notFound("Athlete");
  return json(await userActivities(user, target.user.id, q.limit, q.cursor));
});
