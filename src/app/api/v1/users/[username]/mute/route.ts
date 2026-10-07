import { route, noContent } from "@/server/http/handler";
import { mute, unmute } from "@/server/services/social";

export const POST = route.auth(async ({ user, params }) => {
  await mute(user, String(params.username).toLowerCase());
  return noContent();
});
export const DELETE = route.auth(async ({ user, params }) => {
  await unmute(user, String(params.username).toLowerCase());
  return noContent();
});
