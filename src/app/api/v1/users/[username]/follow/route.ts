import { route, json } from "@/server/http/handler";
import { follow, unfollow } from "@/server/services/social";

const limit = [{ key: "follow:{user}", limit: 60, windowSeconds: 3600 }];
export const POST = route.auth(async ({ user, params }) => json({ state: await follow(user, String(params.username).toLowerCase()) }), { rateLimit: limit });
export const DELETE = route.auth(async ({ user, params }) => json({ state: await unfollow(user, String(params.username).toLowerCase()) }));
