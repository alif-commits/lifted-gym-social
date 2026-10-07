import { route, json, created, parseBody } from "@/server/http/handler";
import { programInputSchema } from "@/lib/validators/template";
import { createProgram, listPrograms } from "@/server/services/templates";

export const GET = route.auth(async ({ user }) => json(await listPrograms(user)));
export const POST = route.auth(async ({ req, user }) => created(await createProgram(user, await parseBody(req, programInputSchema))));
