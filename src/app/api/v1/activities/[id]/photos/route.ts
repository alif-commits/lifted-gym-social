import { route, created } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { addActivityPhoto } from "@/server/services/activities";
import { readImageUpload } from "@/server/services/images";

export const POST = route.auth(
  async ({ req, user, params }) => {
    const { buffer } = await readImageUpload(req);
    return created(await addActivityPhoto(user, uuid.parse(params.id), buffer));
  },
  { rateLimit: [{ key: "upload:{user}", limit: 20, windowSeconds: 600 }] },
);
