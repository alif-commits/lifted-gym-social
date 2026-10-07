import { eq } from "drizzle-orm";
import { json, route } from "@/server/http/handler";
import { getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { config } from "@/server/config";
import { stravaStatus } from "@/server/services/strava";

export const GET = route.auth(async ({ user }) => {
  const [u] = await getDb().select({ googleSub: users.googleSub }).from(users).where(eq(users.id, user.id)).limit(1);
  return json({
    google: { configured: config.google.configured, linked: Boolean(u?.googleSub) },
    strava: { configured: config.strava.configured, ...(await stravaStatus(user.id)) },
  });
});
