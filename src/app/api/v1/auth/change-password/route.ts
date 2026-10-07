import { route, parseBody, noContent } from "@/server/http/handler";
import { changePassword } from "@/server/services/auth";
import { changePasswordSchema } from "@/lib/validators/auth";

export const POST = route.auth(
  async ({ req, user, sessionId }) => {
    const { currentPassword, newPassword } = await parseBody(req, changePasswordSchema);
    await changePassword(user.id, sessionId, currentPassword, newPassword);
    return noContent();
  },
  { rateLimit: [{ key: "change-pw:{user}", limit: 5, windowSeconds: 900 }] },
);
