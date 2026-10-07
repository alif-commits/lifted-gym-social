import { route, json, noContent, parseBody } from "@/server/http/handler";
import { deleteAccountSchema } from "@/lib/validators/auth";
import { meDto } from "@/server/services/dto";
import { deleteAccount } from "@/server/services/account";

export const GET = route.auth(async ({ user }) => json(meDto(user)));
export const DELETE = route.auth(
  async ({ req, user }) => {
    const { password } = await parseBody(req, deleteAccountSchema);
    await deleteAccount(user, password);
    return noContent();
  },
  { rateLimit: [{ key: "delete-account:{user}", limit: 5, windowSeconds: 3600 }] },
);
