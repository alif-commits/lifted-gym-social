import { route, noContent } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { markRead } from "@/server/services/notification-list";

export const POST = route.auth(async ({ user, params }) => {
  await markRead(user.id, uuid.parse(params.id));
  return noContent();
});
