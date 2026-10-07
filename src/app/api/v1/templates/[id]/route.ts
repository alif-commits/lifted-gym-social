import { route, json, noContent, parseBody } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { templateInputSchema } from "@/lib/validators/template";
import { deleteTemplate, getTemplate, updateTemplate } from "@/server/services/templates";

export const GET = route.auth(async ({ user, params }) => json(await getTemplate(user, uuid.parse(params.id))));
export const PUT = route.auth(async ({ req, user, params }) => json(await updateTemplate(user, uuid.parse(params.id), await parseBody(req, templateInputSchema))));
export const DELETE = route.auth(async ({ user, params }) => {
  await deleteTemplate(user, uuid.parse(params.id));
  return noContent();
});
