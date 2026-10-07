import { route, noContent } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { removeActivityPhoto } from "@/server/services/activities";

export const DELETE = route.auth(async ({ user, params }) => {
  await removeActivityPhoto(user, uuid.parse(params.id), uuid.parse(params.photoId));
  return noContent();
});
