import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { toClient } from "@/lib/client/serialize";
import { getSession } from "@/server/auth/session";
import { ApiError } from "@/server/http/errors";
import { getPublicProfile } from "@/server/services/users";
import { ProfileView } from "./profile-view";

async function load(username: string) {
  const session = await getSession();
  try {
    return await getPublicProfile(session?.user ?? null, username.toLowerCase());
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  try {
    const session = await getSession();
    const p = await getPublicProfile(session?.user ?? null, username.toLowerCase());
    return {
      title: `${p.displayName} (@${p.username})`,
      description: p.isPrivate ? "This account is private." : (p.bio ?? `${p.displayName} on Lifted`),
      robots: p.isPrivate ? { index: false } : undefined,
    };
  } catch {
    return { title: "Athlete", robots: { index: false } };
  }
}

export default async function Page({ params }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const profile = await load(username);
  return <ProfileView profile={toClient(profile)} />;
}
