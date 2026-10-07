import { route, json } from "@/server/http/handler";
import { resendVerification } from "@/server/services/auth";

export const POST = route.auth(
  async ({ user }) => json(await resendVerification(user.id)),
  { rateLimit: [{ key: "resend-verify:{user}", limit: 3, windowSeconds: 3600 }] },
);
