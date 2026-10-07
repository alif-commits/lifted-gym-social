import { route, json, noContent, parseBody } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { entryUpdateSchema } from "@/lib/validators/nutrition";
import { deleteEntry, updateEntry } from "@/server/services/nutrition";

export const PATCH = route.auth(async ({ req, user, params }) => json(await updateEntry(user, uuid.parse(params.id), await parseBody(req, entryUpdateSchema))));
export const DELETE = route.auth(async ({ user, params }) => {
  await deleteEntry(user, uuid.parse(params.id));
  return noContent();
});
