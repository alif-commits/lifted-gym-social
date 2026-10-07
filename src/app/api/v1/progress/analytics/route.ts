import { route, json, parseQuery } from "@/server/http/handler";
import { rangeQuerySchema } from "@/lib/validators/progress";
import { getAnalytics } from "@/server/services/progress";

export const GET = route.auth(async ({ req, user }) => json(await getAnalytics(user, parseQuery(req, rangeQuerySchema).range)));
