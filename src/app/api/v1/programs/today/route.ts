import { route, json, noContent } from "@/server/http/handler";
import { todaysProgramDay, unassignProgram } from "@/server/services/templates";

export const GET = route.auth(async ({ user }) => json(await todaysProgramDay(user)));
export const DELETE = route.auth(async ({ user }) => {
  await unassignProgram(user);
  return noContent();
});
