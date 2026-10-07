import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { toClient } from "@/lib/client/serialize";
import { getSession } from "@/server/auth/session";
import { ApiError } from "@/server/http/errors";
import { getActivityDetail } from "@/server/services/activities";
import { ActivityPage } from "./activity-page";

async function load(shortId: string) {
  const session = await getSession();
  try {
    return await getActivityDetail(session?.user.id ?? null, shortId);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: PageProps<"/a/[shortId]">): Promise<Metadata> {
  const { shortId } = await params;
  try {
    const session = await getSession();
    const a = await getActivityDetail(session?.user.id ?? null, shortId);
    // Only public posts get rich previews; everything else stays out of search and unfurls.
    const isPublic = a.visibility === "PUBLIC" && a.status === "PUBLISHED";
    const description = a.description?.slice(0, 160) ?? `${a.setCount} sets · ${a.exerciseCount} exercises by ${a.user.displayName}`;
    return {
      title: `${a.title} by ${a.user.displayName}`,
      description,
      robots: isPublic ? undefined : { index: false, follow: false },
      openGraph: isPublic ? { title: `${a.title} · ${a.user.displayName}`, description, type: "article", images: a.photos[0] ? [{ url: a.photos[0].url }] : undefined } : undefined,
    };
  } catch {
    return { title: "Workout", robots: { index: false } };
  }
}

export default async function Page({ params }: PageProps<"/a/[shortId]">) {
  const { shortId } = await params;
  const activity = await load(shortId);
  return <ActivityPage activity={toClient(activity)} />;
}
