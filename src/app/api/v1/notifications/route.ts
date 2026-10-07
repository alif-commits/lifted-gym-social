import { z } from "zod";
import { route, json, parseQuery } from "@/server/http/handler";
import { paginationQuery } from "@/lib/validators/common";
import { listNotifications } from "@/server/services/notification-list";

export const GET = route.auth(async ({ req, user }) => {
  const q = parseQuery(req, paginationQuery.extend({ unread: z.enum(["true", "false"]).optional() }));
  return json(await listNotifications(user, q.limit, q.cursor, q.unread === "true"));
});
