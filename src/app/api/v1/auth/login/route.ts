import { route, parseBody, json } from "@/server/http/handler";
import { loginUser } from "@/server/services/auth";
import { meDto } from "@/server/services/dto";
import { getSession } from "@/server/auth/session";
import { enforceRateLimit } from "@/server/auth/rate-limit";
import { loginSchema } from "@/lib/validators/auth";

export const POST = route.public(
  async ({ req }) => {
    const input = await parseBody(req, loginSchema);
    // Brute-force protection per account identifier, in addition to the per-IP limit below.
    await enforceRateLimit({ key: `login:id:${input.identifier}`, limit: 8, windowSeconds: 900 });
    await loginUser(input);
    const session = await getSession();
    return json({ user: session ? meDto(session.user) : null });
  },
  { rateLimit: [{ key: "login:ip:{ip}", limit: 30, windowSeconds: 900 }] },
);
