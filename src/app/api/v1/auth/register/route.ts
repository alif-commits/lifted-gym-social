import { route, parseBody, created } from "@/server/http/handler";
import { registerUser } from "@/server/services/auth";
import { meDto } from "@/server/services/dto";
import { getSession } from "@/server/auth/session";
import { registerSchema } from "@/lib/validators/auth";

export const POST = route.public(
  async ({ req }) => {
    const input = await parseBody(req, registerSchema);
    await registerUser(input);
    const session = await getSession();
    return created({ user: session ? meDto(session.user) : null });
  },
  { rateLimit: [{ key: "register:{ip}", limit: 10, windowSeconds: 3600 }] },
);
