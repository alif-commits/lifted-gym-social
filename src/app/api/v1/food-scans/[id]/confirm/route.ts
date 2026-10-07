import { route, json, parseOptionalBody } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { confirmScanSchema } from "@/lib/validators/foodscan";
import { confirmScan } from "@/server/services/foodscan";

export const POST = route.auth(async ({ req, user, params }) => json(await confirmScan(user, uuid.parse(params.id), await parseOptionalBody(req, confirmScanSchema.optional().default({ mealName: "Snack", notes: null })))));
