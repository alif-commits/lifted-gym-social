import { route, noContent } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { deleteProgressPhoto } from "@/server/services/progress";

export const DELETE = route.auth(async ({ user, params }) => {
  await deleteProgressPhoto(user.id, uuid.parse(params.id));
  return noContent();
});
