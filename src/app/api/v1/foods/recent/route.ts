import { route, json } from "@/server/http/handler";
import { recentFoods } from "@/server/services/nutrition";

export const GET = route.auth(async ({ user }) => json(await recentFoods(user)));
