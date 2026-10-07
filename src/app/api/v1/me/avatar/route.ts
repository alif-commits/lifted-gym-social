import { route, json, noContent } from "@/server/http/handler";
import { readImageUpload } from "@/server/services/images";
import { removeAvatar, setAvatar } from "@/server/services/users";

export const POST = route.auth(
  async ({ req, user }) => {
    const { buffer } = await readImageUpload(req);
    return json({ avatarUrl: await setAvatar(user, buffer) });
  },
  { rateLimit: [{ key: "upload:{user}", limit: 20, windowSeconds: 600 }] },
);
export const DELETE = route.auth(async ({ user }) => {
  await removeAvatar(user);
  return noContent();
});
