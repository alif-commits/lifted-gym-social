import { route, json, parseBody } from "@/server/http/handler";
import { updateSettingsSchema } from "@/lib/validators/profile";
import { getSession } from "@/server/auth/session";
import { meDto } from "@/server/services/dto";
import { updateSettings } from "@/server/services/users";

export const PATCH = route.auth(async ({ req, user }) => {
  await updateSettings(user, await parseBody(req, updateSettingsSchema));
  const fresh = await getSession();
  return json(fresh ? meDto(fresh.user) : meDto(user));
});
