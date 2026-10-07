import { route, noContent } from "@/server/http/handler";
import { destroyCurrentSession } from "@/server/auth/session";

export const POST = route.public(async () => {
  await destroyCurrentSession();
  return noContent();
});
