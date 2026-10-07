import { and, eq } from "drizzle-orm";
import { route, noContent } from "@/server/http/handler";
import { getDb } from "@/server/db";
import { sessions } from "@/server/db/schema";
import { notFound } from "@/server/http/errors";
import { uuid } from "@/lib/validators/common";

export const DELETE = route.auth(async ({ user, params }) => {
  const id = uuid.parse(params.id);
  const res = await getDb()
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, id), eq(sessions.userId, user.id)))
    .returning({ id: sessions.id });
  if (res.length === 0) throw notFound("Session");
  return noContent();
});
