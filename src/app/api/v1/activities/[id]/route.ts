import { route, json, noContent, parseBody } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { updateActivitySchema } from "@/lib/validators/activity";
import { deleteActivity, getActivityDetail, updateActivity } from "@/server/services/activities";

export const GET = route.optional(async ({ user, params }) => json(await getActivityDetail(user?.id ?? null, String(params.id))));
export const PATCH = route.auth(async ({ req, user, params }) => json(await updateActivity(user, uuid.parse(params.id), await parseBody(req, updateActivitySchema))));
export const DELETE = route.auth(async ({ user, params }) => {
  await deleteActivity(user, uuid.parse(params.id));
  return noContent();
});
