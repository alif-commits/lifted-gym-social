import { route, json, parseBody } from "@/server/http/handler";
import { updateProfileSchema } from "@/lib/validators/profile";
import { getOwnProfile, updateProfile } from "@/server/services/users";

export const GET = route.auth(async ({ user }) => json(await getOwnProfile(user.id)));
export const PATCH = route.auth(async ({ req, user }) => json(await updateProfile(user, await parseBody(req, updateProfileSchema))));
