import { route, json, parseQuery } from "@/server/http/handler";
import { exploreQuerySchema } from "@/lib/validators/activity";
import { explore } from "@/server/services/feed";

export const GET = route.optional(async ({ req, user }) => {
  const q = parseQuery(req, exploreQuerySchema);
  return json(await explore(user, q));
});
