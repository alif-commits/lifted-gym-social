import { route, noContent } from "@/server/http/handler";
import { markAllRead } from "@/server/services/notification-list";

export const POST = route.auth(async ({ user }) => {
  await markAllRead(user.id);
  return noContent();
});
