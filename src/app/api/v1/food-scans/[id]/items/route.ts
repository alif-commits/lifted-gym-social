import { route, created, parseBody } from "@/server/http/handler";
import { uuid } from "@/lib/validators/common";
import { scanItemCreateSchema } from "@/lib/validators/foodscan";
import { addScanItem } from "@/server/services/foodscan";

export const POST = route.auth(async ({ req, user, params }) => created(await addScanItem(user, uuid.parse(params.id), await parseBody(req, scanItemCreateSchema))));
