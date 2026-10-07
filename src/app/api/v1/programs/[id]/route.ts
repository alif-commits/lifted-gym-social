import { route, json, noContent, parseBody } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { programInputSchema } from "@/lib/validators/template";
import { deleteProgram, getProgram, updateProgram } from "@/server/services/templates";

export const GET = route.auth(async ({ user, params }) => json(await getProgram(user, uuid.parse(params.id))));
export const PUT = route.auth(async ({ req, user, params }) => json(await updateProgram(user, uuid.parse(params.id), await parseBody(req, programInputSchema))));
export const DELETE = route.auth(async ({ user, params }) => {
  await deleteProgram(user, uuid.parse(params.id));
  return noContent();
});
