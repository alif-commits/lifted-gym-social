import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/feedback";
import { ApiError } from "@/server/http/errors";
import { getShareCard } from "@/server/services/nutrition";

async function load(id: string) {
  try {
    return await getShareCard(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const { id } = await params;
  try {
    const c = await getShareCard(id);
    return { title: `${c.owner.displayName}'s nutrition day`, description: c.metrics.map((m) => `${m.label}: ${Math.round(m.value)}`).join(" · "), robots: { index: false } };
  } catch {
    return { title: "Nutrition", robots: { index: false } };
  }
}

const UNIT: Record<string, string> = { calories: "kcal", proteinG: "g", carbsG: "g", fatG: "g", fiberG: "g" };

export default async function Page({ params }: PageProps<"/s/[id]">) {
  const { id } = await params;
  const c = await load(id);
  return (
    <div className="mx-auto max-w-md">
      <Card className="overflow-hidden">
        <div className="bg-accent px-6 py-5 text-accent-fg">
          <p className="text-xs font-bold uppercase tracking-widest">Daily nutrition</p>
          <p className="display mt-1 text-4xl">{new Date(`${c.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}</p>
        </div>
        <dl className="grid grid-cols-2 gap-px bg-line">
          {c.metrics.map((m) => (
            <div key={m.key} className="bg-surface p-5">
              <dt className="text-xs font-medium uppercase tracking-wider text-subtle">{m.label}</dt>
              <dd className="display num mt-1 text-5xl">
                {Math.round(m.value).toLocaleString()}
                <span className="ml-1 text-base text-muted">{UNIT[m.key] ?? ""}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="px-6 py-4 text-sm text-muted">
          Shared by{" "}
          <Link href={`/u/${c.owner.username}`} className="font-semibold text-fg hover:underline">
            {c.owner.displayName}
          </Link>
          . Only the selected totals are visible.
        </p>
      </Card>
      <div className="mt-6 text-center">
        <ButtonLink href="/register">Track yours on Lifted</ButtonLink>
      </div>
    </div>
  );
}
