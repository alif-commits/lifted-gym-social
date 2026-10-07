import { z } from "zod";
import { paginationQuery } from "@/lib/validators/common";
import { json, parseQuery, route } from "@/server/http/handler";
import { listAdminUsers } from "@/server/services/admin";

const query = paginationQuery.extend({
  q: z.string().trim().max(80).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  role: z.enum(["user", "moderator", "admin"]).optional(),
});

export const GET = route.auth(
  async ({ req }) => {
    const q = parseQuery(req, query);
    return json(await listAdminUsers(q.q, q.status, q.role, q.limit, q.cursor));
  },
  { roles: ["admin", "moderator"] },
);
