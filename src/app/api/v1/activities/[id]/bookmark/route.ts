import { route, json } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { bookmarkActivity, unbookmarkActivity } from "@/server/services/engagement";

export const POST = route.auth(async ({ user, params }) => json(await bookmarkActivity(user, uuid.parse(params.id))));
export const DELETE = route.auth(async ({ user, params }) => json(await unbookmarkActivity(user, uuid.parse(params.id))));
