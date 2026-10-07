import { route, json, noContent, parseBody } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { scanItemUpdateSchema } from "@/lib/validators/foodscan";
import { deleteScanItem, updateScanItem } from "@/server/services/foodscan";

export const PATCH = route.auth(async ({ req, user, params }) => json(await updateScanItem(user, uuid.parse(params.id), uuid.parse(params.itemId), await parseBody(req, scanItemUpdateSchema))));
export const DELETE = route.auth(async ({ user, params }) => {
  await deleteScanItem(user, uuid.parse(params.id), uuid.parse(params.itemId));
  return noContent();
});
