import { route, json, created, parseBody } from "@/server/http/handler";
import { templateInputSchema } from "@/lib/validators/template";
import { createTemplate, listTemplates } from "@/server/services/templates";

export const GET = route.auth(async ({ user }) => json(await listTemplates(user)));
export const POST = route.auth(async ({ req, user }) => created(await createTemplate(user, await parseBody(req, templateInputSchema))));
