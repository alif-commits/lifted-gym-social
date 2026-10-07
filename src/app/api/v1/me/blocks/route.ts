import { route, json } from "@/server/http/handler";
import { listBlocked } from "@/server/services/social";

export const GET = route.auth(async ({ user }) => json(await listBlocked(user)));
