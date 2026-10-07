import { z } from "zod";
import { json, parseQuery, route } from "@/server/http/handler";
import { friendsLeaderboard, LEADERBOARD_METRICS, LEADERBOARD_WINDOWS } from "@/server/services/leaderboards";

const query = z.object({
  metric: z.enum(LEADERBOARD_METRICS).default("workouts"),
  window: z.enum(LEADERBOARD_WINDOWS).default("week"),
});

export const GET = route.auth(async ({ req, user }) => {
  const q = parseQuery(req, query);
  return json({ metric: q.metric, window: q.window, items: await friendsLeaderboard(user, q.metric, q.window) });
});
