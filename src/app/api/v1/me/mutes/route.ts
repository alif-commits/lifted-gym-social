import { route, json } from "@/server/http/handler";
import { listMuted } from "@/server/services/social";

export const GET = route.auth(async ({ user }) => json(await listMuted(user)));
