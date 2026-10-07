import { route, noContent } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { deleteMeasurement } from "@/server/services/progress";

export const DELETE = route.auth(async ({ user, params }) => {
  await deleteMeasurement(user.id, uuid.parse(params.id));
  return noContent();
});
