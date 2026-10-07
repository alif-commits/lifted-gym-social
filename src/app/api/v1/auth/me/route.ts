import { route, json } from "@/server/http/handler";
import { meDto } from "@/server/services/dto";

export const GET = route.auth(async ({ user }) => json(meDto(user)));
