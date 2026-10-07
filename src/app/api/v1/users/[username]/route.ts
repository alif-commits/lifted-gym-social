import { route, json } from "@/server/http/handler";
import { getPublicProfile } from "@/server/services/users";

export const GET = route.optional(async ({ user, params }) => json(await getPublicProfile(user, String(params.username).toLowerCase())));
