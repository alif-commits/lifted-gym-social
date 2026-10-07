import { z } from "zod";
import { route, json, created, parseBody } from "@/server/http/handler";
import { listExports, requestExport } from "@/server/services/account";

export const GET = route.auth(async ({ user }) => json(await listExports(user.id)));
export const POST = route.auth(
  async ({ req, user }) => {
    const { format } = await parseBody(req, z.object({ format: z.enum(["JSON", "CSV"]).default("JSON") }));
    return created(await requestExport(user, format));
  },
  { rateLimit: [{ key: "export:{user}", limit: 5, windowSeconds: 3600 }] },
);
