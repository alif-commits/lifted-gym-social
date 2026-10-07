import { loginSchema } from "@/lib/validators/auth";
import { enforceRateLimit } from "@/server/auth/rate-limit";
import { getSession } from "@/server/auth/session";
import { json, parseBody, route } from "@/server/http/handler";
import { loginStaff } from "@/server/services/auth";
import { meDto } from "@/server/services/dto";

export const POST = route.public(
  async ({ req }) => {
    const input = await parseBody(req, loginSchema);
    await enforceRateLimit({ key: `admin-login:id:${input.identifier}`, limit: 8, windowSeconds: 900 });
    await loginStaff(input);
    const session = await getSession();
    return json({ user: session ? meDto(session.user) : null });
  },
  { rateLimit: [{ key: "admin-login:ip:{ip}", limit: 20, windowSeconds: 900 }] },
);
