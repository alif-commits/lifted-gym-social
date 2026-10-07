import { route, json, parseQuery } from "@/server/http/handler";
import { searchQuerySchema } from "@/lib/validators/activity";
import { search } from "@/server/services/feed";

export const GET = route.optional(
  async ({ req, user }) => {
    const q = parseQuery(req, searchQuerySchema);
    return json(await search(user, q.q, q.type, q.limit));
  },
  { rateLimit: [{ key: "search:{ip}", limit: 120, windowSeconds: 60 }] },
);
