import { json, route } from "@/server/http/handler";
import { config } from "@/server/config";

export const GET = route.public(async () => json({ google: config.google.configured, strava: config.strava.configured }));
