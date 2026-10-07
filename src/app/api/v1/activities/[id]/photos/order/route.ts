import { route, noContent, parseBody } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { reorderPhotosSchema } from "@/lib/validators/activity";
import { reorderActivityPhotos } from "@/server/services/activities";

export const PUT = route.auth(async ({ req, user, params }) => {
  await reorderActivityPhotos(user, uuid.parse(params.id), (await parseBody(req, reorderPhotosSchema)).photoIds);
  return noContent();
});
