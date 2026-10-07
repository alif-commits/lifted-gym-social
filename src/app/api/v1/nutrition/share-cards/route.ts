import { route, created, parseBody } from "@/server/http/handler";
import { shareCardSchema } from "@/lib/validators/nutrition";
import { createShareCard } from "@/server/services/nutrition";

export const POST = route.auth(async ({ req, user }) => {
  const body = await parseBody(req, shareCardSchema);
  return created(await createShareCard(user, body.date, body.metrics));
});
