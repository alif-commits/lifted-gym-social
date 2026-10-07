import { z } from "zod";
import { route, noContent, parseBody } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { deleteComment, editComment } from "@/server/services/engagement";

export const PATCH = route.auth(async ({ req, user, params }) => {
  const { text } = await parseBody(req, z.object({ text: z.string().trim().min(1).max(1000) }));
  await editComment(user, uuid.parse(params.id), text);
  return noContent();
});
export const DELETE = route.auth(async ({ user, params }) => {
  await deleteComment(user, uuid.parse(params.id));
  return noContent();
});
