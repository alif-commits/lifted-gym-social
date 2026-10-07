"use client";

import { useQuery } from "@tanstack/react-query";
import { Compass } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ActivityCard } from "@/components/app/activity-card";
import { InfiniteList } from "@/components/app/infinite-list";
import { PageHeader } from "@/components/app/page-header";
import { SuggestedAthletes } from "@/components/app/suggested-athletes";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/form";
import { get } from "@/lib/client/api";
import { useList } from "@/lib/client/hooks";
import type { ActivityCard as Card } from "@/lib/client/types";

export function ExploreView() {
  const [sort, setSort] = useState<"trending" | "recent">("trending");
  const list = useList<Card>(["explore"], "/explore", { sort });
  const tags = useQuery({ queryKey: ["trending-tags"], queryFn: () => get<Array<{ tag: string; n: number }>>("/explore/hashtags"), staleTime: 120_000 });

  return (
    <>
      <PageHeader title="Explore" subtitle="Public sessions from across the community." actions={<Segmented label="Sort" value={sort} onChange={setSort} options={[{ value: "trending", label: "Trending" }, { value: "recent", label: "Recent" }]} />} />
      {tags.data?.length ? (
        <nav aria-label="Trending hashtags" className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {tags.data.map((t) => (
            <Link key={t.tag} href={`/hashtag/${encodeURIComponent(t.tag)}`} className="shrink-0 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-muted hover:border-accent hover:text-accent">
              #{t.tag} <span className="num text-xs text-subtle">{t.n}</span>
            </Link>
          ))}
        </nav>
      ) : null}
      <div className="mb-6">
        <SuggestedAthletes limit={3} title="Athletes worth following" />
      </div>
      <InfiniteList
        list={list}
        items={list.items}
        skeleton={<Skeleton className="h-72" />}
        render={(a) => <ActivityCard key={a.id} activity={a} />}
        empty={<EmptyState icon={<Compass className="h-7 w-7" aria-hidden />} title="Nothing to explore yet" description="Public workouts will show up here as soon as people start sharing." />}
      />
    </>
  );
}
