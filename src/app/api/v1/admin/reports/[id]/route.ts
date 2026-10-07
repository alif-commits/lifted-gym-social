import { z } from "zod";
import { route, json, parseBody } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { resolveReport } from "@/server/services/moderation";

export const POST = route.auth(
  async ({ req, user, params }) => {
    const body = await parseBody(req, z.object({ action: z.enum(["DISMISS", "REMOVE_CONTENT", "SUSPEND_USER"]), reason: z.string().trim().max(500).nullish() }));
    return json(await resolveReport(user, uuid.parse(params.id), body.action, body.reason ?? null));
  },
  { roles: ["admin", "moderator"] },
);
