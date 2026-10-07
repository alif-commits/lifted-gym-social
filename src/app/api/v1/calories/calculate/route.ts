import { route, json, parseBody } from "@/server/http/handler";
import { calorieCalcSchema } from "@/lib/validators/nutrition";
import { calculateAndMaybeSave } from "@/server/services/nutrition";

export const POST = route.auth(async ({ req, user }) => json(await calculateAndMaybeSave(user, await parseBody(req, calorieCalcSchema))));
