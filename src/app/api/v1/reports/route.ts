import { route, created, parseBody } from "@/server/http/handler";
import { reportSchema } from "@/lib/validators/activity";
import { createReport } from "@/server/services/moderation";

export const POST = route.auth(async ({ req, user }) => created(await createReport(user, await parseBody(req, reportSchema))), { rateLimit: [{ key: "report:{user}", limit: 20, windowSeconds: 3600 }] });
