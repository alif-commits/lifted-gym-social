import { z } from "zod";
import { route, json, created, parseBody, parseQuery } from "@/server/http/handler";
import { MEASUREMENT_TYPES } from "@/lib/constants";
import { measurementInputSchema, rangeQuerySchema } from "@/lib/validators/progress";
import { addMeasurement, listMeasurements } from "@/server/services/progress";

export const GET = route.auth(async ({ req, user }) => {
  const q = parseQuery(req, rangeQuerySchema.extend({ type: z.enum(MEASUREMENT_TYPES).optional() }));
  return json(await listMeasurements(user, q.range, q.type));
});
export const POST = route.auth(async ({ req, user }) => created(await addMeasurement(user, await parseBody(req, measurementInputSchema))));
