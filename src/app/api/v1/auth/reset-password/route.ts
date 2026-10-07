import { route, parseBody, noContent } from "@/server/http/handler";
import { resetPassword } from "@/server/services/auth";
import { resetPasswordSchema } from "@/lib/validators/auth";

export const POST = route.public(
  async ({ req }) => {
    const { token, password } = await parseBody(req, resetPasswordSchema);
    await resetPassword(token, password);
    return noContent();
  },
  { rateLimit: [{ key: "reset:{ip}", limit: 10, windowSeconds: 3600 }] },
);
