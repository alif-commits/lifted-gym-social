import { route, json } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { publishActivity } from "@/server/services/activities";

export const POST = route.auth(async ({ user, params }) => json(await publishActivity(user, uuid.parse(params.id))));
