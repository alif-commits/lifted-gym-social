"use client";

import { Bookmark } from "lucide-react";
import { ActivityCard } from "@/components/app/activity-card";
import { InfiniteList } from "@/components/app/infinite-list";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { useList } from "@/lib/client/hooks";
import type { ActivityCard as Card } from "@/lib/client/types";

export function BookmarksView() {
  const list = useList<Card>(["bookmarks"], "/me/bookmarks");
  return (
    <>
      <PageHeader title="Bookmarks" subtitle="Sessions you saved for later." />
      <InfiniteList list={list} items={list.items} skeleton={<Skeleton className="h-72" />} render={(a) => <ActivityCard key={a.id} activity={a} />} empty={<EmptyState icon={<Bookmark className="h-7 w-7" aria-hidden />} title="Nothing saved" description="Tap the bookmark on any session to keep it here." />} />
    </>
  );
}
