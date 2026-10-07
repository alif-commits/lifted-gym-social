import { json, route } from "@/server/http/handler";
import { adminStats } from "@/server/services/admin";

export const GET = route.auth(async () => json(await adminStats()), { roles: ["admin", "moderator"] });
