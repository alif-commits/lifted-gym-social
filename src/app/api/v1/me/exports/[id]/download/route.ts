import { route } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { getExportFile } from "@/server/services/account";

export const GET = route.auth(async ({ user, params }) => {
  const { file, filename } = await getExportFile(user.id, uuid.parse(params.id));
  return new Response(file.stream, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
