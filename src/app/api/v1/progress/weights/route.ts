import { route, json, created, parseBody, parseQuery } from "@/server/http/handler";
import { rangeQuerySchema, weightInputSchema } from "@/lib/validators/progress";
import { addWeight, listWeights } from "@/server/services/progress";

export const GET = route.auth(async ({ req, user }) => json(await listWeights(user, parseQuery(req, rangeQuerySchema).range)));
export const POST = route.auth(async ({ req, user }) => created(await addWeight(user, await parseBody(req, weightInputSchema))));
