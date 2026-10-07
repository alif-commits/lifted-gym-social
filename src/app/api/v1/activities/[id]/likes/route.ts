import { route, json } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { listLikers } from "@/server/services/engagement";

export const GET = route.optional(async ({ user, params }) => json(await listLikers(user, uuid.parse(params.id))));
