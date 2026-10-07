import { route, json } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { retryScan } from "@/server/services/foodscan";

export const maxDuration = 60;
export const POST = route.auth(async ({ user, params }) => json(await retryScan(user, uuid.parse(params.id))), { rateLimit: [{ key: "scan:hour:{user}", limit: 30, windowSeconds: 3600 }] });
