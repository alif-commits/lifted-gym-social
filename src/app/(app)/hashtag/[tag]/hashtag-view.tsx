"use client";

import { Hash } from "lucide-react";
import { ActivityCard } from "@/components/app/activity-card";
import { InfiniteList } from "@/components/app/infinite-list";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { useList } from "@/lib/client/hooks";
import type { ActivityCard as Card } from "@/lib/client/types";

export function HashtagView({ tag }: { tag: string }) {
  const list = useList<Card>(["hashtag", tag], `/hashtags/${encodeURIComponent(tag)}/activities`);
  return (
    <>
      <PageHeader title={<span className="text-accent">#{tag}</span>} subtitle="Recent public sessions with this tag." />
      <InfiniteList list={list} items={list.items} skeleton={<Skeleton className="h-72" />} render={(a) => <ActivityCard key={a.id} activity={a} />} empty={<EmptyState icon={<Hash className="h-7 w-7" aria-hidden />} title="No sessions yet" description={`Nobody has published a workout with #${tag} yet.`} />} />
    </>
  );
}
