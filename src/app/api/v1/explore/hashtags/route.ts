import { route, json } from "@/server/http/handler";
import { trendingHashtags } from "@/server/services/feed";

export const GET = route.public(async () => json(await trendingHashtags()));
