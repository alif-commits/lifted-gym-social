import { route, json } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { likeComment } from "@/server/services/engagement";

export const POST = route.auth(async ({ user, params }) => json(await likeComment(user, uuid.parse(params.id), true)));
export const DELETE = route.auth(async ({ user, params }) => json(await likeComment(user, uuid.parse(params.id), false)));
