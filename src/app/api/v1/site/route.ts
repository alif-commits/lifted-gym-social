import { json, route } from "@/server/http/handler";
import { publicSite } from "@/server/services/site-settings";

export const GET = route.public(async () => json(await publicSite()));
