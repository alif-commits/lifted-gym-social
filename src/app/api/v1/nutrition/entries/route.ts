import { route, created, parseBody } from "@/server/http/handler";
import { entryInputSchema } from "@/lib/validators/nutrition";
import { createEntry } from "@/server/services/nutrition";

export const POST = route.auth(async ({ req, user }) => created(await createEntry(user, await parseBody(req, entryInputSchema))));
