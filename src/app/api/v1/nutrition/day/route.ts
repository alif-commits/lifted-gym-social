import { route, json, parseQuery } from "@/server/http/handler";
import { nutritionDayQuery } from "@/lib/validators/nutrition";
import { getDay } from "@/server/services/nutrition";

export const GET = route.auth(async ({ req, user }) => json(await getDay(user, parseQuery(req, nutritionDayQuery).date)));
