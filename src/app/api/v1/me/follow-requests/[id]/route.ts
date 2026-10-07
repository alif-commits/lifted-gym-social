import { z } from "zod";
import { route, noContent, parseBody } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { respondToFollowRequest } from "@/server/services/social";

export const POST = route.auth(async ({ req, user, params }) => {
  const { accept } = await parseBody(req, z.object({ accept: z.boolean() }));
  await respondToFollowRequest(user, uuid.parse(params.id), accept);
  return noContent();
});
