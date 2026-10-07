import { route, json } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { exerciseHistory } from "@/server/services/exercises";

export const GET = route.auth(async ({ user, params }) => json(await exerciseHistory(user, uuid.parse(params.id))));
