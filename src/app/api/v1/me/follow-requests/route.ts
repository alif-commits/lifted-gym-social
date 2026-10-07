import { route, json } from "@/server/http/handler";
import { listFollowRequests } from "@/server/services/social";

export const GET = route.auth(async ({ user }) => json(await listFollowRequests(user)));
