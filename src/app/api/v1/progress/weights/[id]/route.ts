import { route, noContent } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { deleteWeight } from "@/server/services/progress";

export const DELETE = route.auth(async ({ user, params }) => {
  await deleteWeight(user.id, uuid.parse(params.id));
  return noContent();
});
