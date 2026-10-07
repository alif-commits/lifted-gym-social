import { route, json, noContent } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { cancelScan, getScan } from "@/server/services/foodscan";

export const GET = route.auth(async ({ user, params }) => json(await getScan(user, uuid.parse(params.id))));
export const DELETE = route.auth(async ({ user, params }) => {
  await cancelScan(user, uuid.parse(params.id));
  return noContent();
});
