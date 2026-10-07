import { route, json } from "@/server/http/handler";
import { listPersonalRecords } from "@/server/services/progress";

export const GET = route.auth(async ({ user }) => json(await listPersonalRecords(user)));
