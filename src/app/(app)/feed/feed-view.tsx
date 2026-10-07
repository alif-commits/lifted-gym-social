"use client";

import { Dumbbell, Users } from "lucide-react";
import { ActivityCard } from "@/components/app/activity-card";
import { InfiniteList } from "@/components/app/infinite-list";
import { PageHeader } from "@/components/app/page-header";
import { SuggestedAthletes } from "@/components/app/suggested-athletes";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { useList } from "@/lib/client/hooks";
import type { ActivityCard as Card } from "@/lib/client/types";

export function FeedView() {
  const list = useList<Card>(["feed"], "/feed");
  return (
    <>
      <PageHeader
        title="Your feed"
        subtitle="Sessions from you and the athletes you follow."
        actions={
          <ButtonLink href="/workout/new">
            <Dumbbell className="h-4 w-4" aria-hidden /> Start workout
          </ButtonLink>
        }
      />
      <InfiniteList
        list={list}
        items={list.items}
        skeleton={<Skeleton className="h-72" />}
        render={(a) => <ActivityCard key={a.id} activity={a} />}
        empty={
          <div className="space-y-6">
            <EmptyState
              icon={<Users className="h-7 w-7" aria-hidden />}
              title="It's quiet in here"
              description="Follow a few athletes or publish your first workout and it will show up here."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <ButtonLink href="/explore">Explore athletes</ButtonLink>
                  <ButtonLink href="/workout/new" variant="outline">
                    Log a workout
                  </ButtonLink>
                </div>
              }
            />
            <SuggestedAthletes />
          </div>
        }
      />
    </>
  );
}
