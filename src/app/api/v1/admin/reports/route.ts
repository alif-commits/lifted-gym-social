import { z } from "zod";
import { route, json, parseQuery } from "@/server/http/handler";
import { listReports, reportCounts } from "@/server/services/moderation";

export const GET = route.auth(
  async ({ req }) => {
    const q = parseQuery(req, z.object({ status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]).default("OPEN"), limit: z.coerce.number().int().min(1).max(100).default(50) }));
    return json({ counts: await reportCounts(), items: await listReports(q.status, q.limit) });
  },
  { roles: ["admin", "moderator"] },
);
