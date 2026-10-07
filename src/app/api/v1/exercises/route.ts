import { route, json, created, parseBody, parseQuery } from "@/server/http/handler";
import { exerciseInputSchema, exerciseQuerySchema } from "@/lib/validators/exercise";
import { createExercise, listExercises } from "@/server/services/exercises";

export const GET = route.auth(async ({ req, user }) => json(await listExercises(user, parseQuery(req, exerciseQuerySchema))));
export const POST = route.auth(async ({ req, user }) => created(await createExercise(user, await parseBody(req, exerciseInputSchema))));
