import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { ModerationQueue } from "./moderation-queue";

export const metadata: Metadata = { title: "Moderation" };

export default async function Page() {
  const session = await getSession();
  if (!session || (session.user.role !== "admin" && session.user.role !== "moderator")) notFound();
  return <ModerationQueue />;
}
