import { route, noContent } from "@/server/http/handler";
import { resendVerification } from "@/server/services/auth";

export const POST = route.auth(
  async ({ user }) => {
    await resendVerification(user.id);
    return noContent();
  },
  { rateLimit: [{ key: "resend-verify:{user}", limit: 3, windowSeconds: 3600 }] },
);
