import { route, parseBody, noContent } from "@/server/http/handler";
import { requestPasswordReset } from "@/server/services/auth";
import { forgotPasswordSchema } from "@/lib/validators/auth";

export const POST = route.public(
  async ({ req }) => {
    const { email } = await parseBody(req, forgotPasswordSchema);
    await requestPasswordReset(email);
    return noContent();
  },
  { rateLimit: [{ key: "forgot:{ip}", limit: 5, windowSeconds: 3600 }] },
);
