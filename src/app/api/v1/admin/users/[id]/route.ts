import { z } from "zod";
import { USER_ROLES } from "@/lib/constants";
import { uuid } from "@/lib/validators/common";
import { json, parseBody, route } from "@/server/http/handler";
import { updateAdminUser } from "@/server/services/admin";

const body = z
  .object({
    role: z.enum(USER_ROLES).optional(),
    status: z.enum(["active", "suspended"]).optional(),
  })
  .refine((v) => v.role || v.status, "Provide a role or status");

export const PATCH = route.auth(
  async ({ req, user, params }) => json(await updateAdminUser(user, uuid.parse(params.id), await parseBody(req, body))),
  { roles: ["admin"] },
);
