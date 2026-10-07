import { route, json } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { likeActivity, unlikeActivity } from "@/server/services/engagement";

export const POST = route.auth(async ({ user, params }) => json(await likeActivity(user, uuid.parse(params.id))), { rateLimit: [{ key: "like:{user}", limit: 120, windowSeconds: 60 }] });
export const DELETE = route.auth(async ({ user, params }) => json(await unlikeActivity(user, uuid.parse(params.id))));
