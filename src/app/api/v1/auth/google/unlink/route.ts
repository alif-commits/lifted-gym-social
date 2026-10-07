import { json, route } from "@/server/http/handler";
import { unlinkGoogle } from "@/server/services/google-auth";

export const POST = route.auth(async ({ user }) => {
  await unlinkGoogle(user.id);
  return json({ linked: false });
});
