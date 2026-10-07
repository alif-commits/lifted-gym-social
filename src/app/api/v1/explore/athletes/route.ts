import { route, json } from "@/server/http/handler";
import { suggestedAthletes } from "@/server/services/feed";

export const GET = route.optional(async ({ user }) => json(await suggestedAthletes(user)));
