import { route, json, created, parseBody } from "@/server/http/handler";
import { goalInputSchema } from "@/lib/validators/progress";
import { createGoal, listGoals } from "@/server/services/progress";

export const GET = route.auth(async ({ user }) => json(await listGoals(user)));
export const POST = route.auth(async ({ req, user }) => created(await createGoal(user, await parseBody(req, goalInputSchema))));
