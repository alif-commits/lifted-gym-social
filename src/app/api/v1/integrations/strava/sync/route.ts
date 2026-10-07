import { json, route } from "@/server/http/handler";
import { requireStravaConfigured, syncStrava } from "@/server/services/strava";

export const POST = route.auth(async ({ user }) => {
  requireStravaConfigured();
  return json(await syncStrava(user));
});
