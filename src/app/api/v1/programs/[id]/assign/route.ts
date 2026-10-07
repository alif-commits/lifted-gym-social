import { z } from "zod";
import { route, noContent, parseOptionalBody } from "@/server/http/handler";
import { dateString, uuid } from "@/lib/validators/common";
import { assignProgram } from "@/server/services/templates";

export const POST = route.auth(async ({ req, user, params }) => {
  const body = await parseOptionalBody(req, z.object({ startDate: dateString.optional() }).optional());
  await assignProgram(user, uuid.parse(params.id), body?.startDate);
  return noContent();
});
