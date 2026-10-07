import { route, noContent } from "@/server/http/handler";
import { block, unblock } from "@/server/services/social";

export const POST = route.auth(async ({ user, params }) => {
  await block(user, String(params.username).toLowerCase());
  return noContent();
});
export const DELETE = route.auth(async ({ user, params }) => {
  await unblock(user, String(params.username).toLowerCase());
  return noContent();
});
