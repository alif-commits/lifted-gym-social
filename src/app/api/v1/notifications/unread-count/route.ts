import { route, json } from "@/server/http/handler";
import { unreadCount } from "@/server/services/notification-list";

export const GET = route.auth(async ({ user }) => json({ count: await unreadCount(user.id) }));
