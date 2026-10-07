import { json, parseBody, route } from "@/server/http/handler";
import { updateSiteSettingsSchema } from "@/lib/validators/site";
import { getSiteSettings, updateSiteSettings } from "@/server/services/site-settings";

export const GET = route.auth(async () => json(await getSiteSettings()), { roles: ["admin"] });

export const PUT = route.auth(
  async ({ req, user }) => json(await updateSiteSettings(user, await parseBody(req, updateSiteSettingsSchema))),
  { roles: ["admin"] },
);
