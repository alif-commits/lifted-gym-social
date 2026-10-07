import { route, noContent } from "@/server/http/handler";
import { removeFollower } from "@/server/services/social";

export const DELETE = route.auth(async ({ user, params }) => {
  await removeFollower(user, String(params.username).toLowerCase());
  return noContent();
});
