import { route, json, parseQuery } from "@/server/http/handler";
import { feedQuerySchema } from "@/lib/validators/activity";
import { homeFeed } from "@/server/services/feed";

export const GET = route.auth(async ({ req, user }) => {
  const q = parseQuery(req, feedQuerySchema);
  return json(await homeFeed(user, q.limit, q.cursor));
});
