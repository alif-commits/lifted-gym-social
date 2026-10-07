import { route, json, created, parseBody, parseQuery } from "@/server/http/handler";
import { paginationQuery, uuid } from "@/lib/validators/common";
import { commentInputSchema } from "@/lib/validators/activity";
import { addComment, listComments } from "@/server/services/engagement";

export const GET = route.optional(async ({ req, user, params }) => {
  const q = parseQuery(req, paginationQuery);
  return json(await listComments(user, uuid.parse(params.id), q.limit, q.cursor));
});
export const POST = route.auth(
  async ({ req, user, params }) => {
    const body = await parseBody(req, commentInputSchema);
    return created(await addComment(user, uuid.parse(params.id), body.text, body.parentCommentId));
  },
  { rateLimit: [{ key: "comment:{user}", limit: 30, windowSeconds: 60 }] },
);
