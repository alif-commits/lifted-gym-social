import { z } from "zod";
import { route, created, parseOptionalBody } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { templateFromWorkout } from "@/server/services/templates";

export const POST = route.auth(async ({ req, user, params }) => {
  const body = await parseOptionalBody(req, z.object({ name: z.string().trim().min(1).max(120).optional() }).optional());
  return created(await templateFromWorkout(user, uuid.parse(params.id), body?.name));
});
