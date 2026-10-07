import { z } from "zod";
import { route, json, parseQuery } from "@/server/http/handler";
import { usernameSchema } from "@/lib/validators/auth";
import { isUsernameAvailable } from "@/server/services/users";

export const GET = route.public(
  async ({ req }) => {
    const { username } = parseQuery(req, z.object({ username: usernameSchema }));
    return json({ available: await isUsernameAvailable(username) });
  },
  { rateLimit: [{ key: "username-check:{ip}", limit: 60, windowSeconds: 300 }] },
);
