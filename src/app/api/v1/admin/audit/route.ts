import { z } from "zod";
import { json, parseQuery, route } from "@/server/http/handler";
import { listAdminAudit } from "@/server/services/admin";

const query = z.object({ limit: z.coerce.number().int().min(1).max(80).default(40) });

export const GET = route.auth(
  async ({ req }) => json({ items: await listAdminAudit(parseQuery(req, query).limit) }),
  { roles: ["admin", "moderator"] },
);
