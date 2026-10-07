import { route, json, created, parseQuery } from "@/server/http/handler";
import { paginationQuery } from "@/lib/validators/common";
import { progressPhotoMetaSchema } from "@/lib/validators/progress";
import { readImageUpload } from "@/server/services/images";
import { addProgressPhoto, listProgressPhotos } from "@/server/services/progress";

export const GET = route.auth(async ({ req, user }) => {
  const q = parseQuery(req, paginationQuery);
  return json(await listProgressPhotos(user, q.limit, q.cursor));
});
export const POST = route.auth(
  async ({ req, user }) => {
    const { buffer, form } = await readImageUpload(req);
    const meta = progressPhotoMetaSchema.parse({
      photoType: form.get("photoType") ?? "CUSTOM",
      recordedAt: form.get("recordedAt") || undefined,
      notes: form.get("notes") || undefined,
    });
    return created(await addProgressPhoto(user, buffer, meta));
  },
  { rateLimit: [{ key: "upload:{user}", limit: 20, windowSeconds: 600 }] },
);
