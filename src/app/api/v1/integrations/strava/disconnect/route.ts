import { json, route } from "@/server/http/handler";
import { disconnectStrava } from "@/server/services/strava";

export const POST = route.auth(async ({ user }) => json(await disconnectStrava(user)));
