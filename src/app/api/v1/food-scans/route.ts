import { route, json, created } from "@/server/http/handler";
import { createScan, listScans } from "@/server/services/foodscan";
import { readImageUpload } from "@/server/services/images";

export const maxDuration = 60;

export const GET = route.auth(async ({ user }) => json(await listScans(user)));
export const POST = route.auth(
  async ({ user, req }) => {
    const { buffer } = await readImageUpload(req);
    const { scan, reused } = await createScan(user, buffer);
    return reused ? json({ ...scan, reused }) : created({ ...scan, reused });
  },
  { rateLimit: [{ key: "scan:hour:{user}", limit: 30, windowSeconds: 3600 }, { key: "scan:day:{user}", limit: 100, windowSeconds: 86400 }] },
);
