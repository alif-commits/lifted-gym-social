import { route, parseBody, noContent } from "@/server/http/handler";
import { verifyEmail } from "@/server/services/auth";
import { verifyEmailSchema } from "@/lib/validators/auth";

export const POST = route.public(
  async ({ req }) => {
    const { token } = await parseBody(req, verifyEmailSchema);
    await verifyEmail(token);
    return noContent();
  },
  { rateLimit: [{ key: "verify:{ip}", limit: 20, windowSeconds: 900 }] },
);
