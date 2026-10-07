import { route, json } from "@/server/http/handler";
import { listOwnDrafts } from "@/server/services/activities";

export const GET = route.auth(async ({ user }) => json(await listOwnDrafts(user)));
