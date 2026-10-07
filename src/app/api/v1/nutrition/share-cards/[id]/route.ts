import { route, json, noContent } from "@/server/http/handler";
import { deleteShareCard, getShareCard } from "@/server/services/nutrition";

export const GET = route.public(async ({ params }) => json(await getShareCard(String(params.id))), { rateLimit: [{ key: "share:{ip}", limit: 120, windowSeconds: 60 }] });
export const DELETE = route.auth(async ({ user, params }) => {
  await deleteShareCard(user, String(params.id));
  return noContent();
});
