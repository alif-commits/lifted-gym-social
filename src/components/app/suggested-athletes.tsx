"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/client/api";
import type { UserSummary } from "@/lib/client/types";
import { Card, SectionTitle, Skeleton } from "@/components/ui/feedback";
import { FollowButton } from "./follow-button";
import { PersonRow } from "./person-row";

type Athlete = UserSummary & { followers: number; recentActivities: number };

export function useSuggestedAthletes() {
  return useQuery({ queryKey: ["athletes"], queryFn: () => get<Athlete[]>("/explore/athletes"), staleTime: 60_000 });
}

export function SuggestedAthletes({ limit = 5, title = "Athletes to follow" }: { limit?: number; title?: string }) {
  const { data, isLoading } = useSuggestedAthletes();
  if (!isLoading && !data?.length) return null;
  return (
    <Card as="section" className="p-4">
      <SectionTitle className="!mb-1">{title}</SectionTitle>
      {isLoading ? (
        <div className="space-y-3 pt-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {data!.slice(0, limit).map((u) => (
            <li key={u.id}>
              <PersonRow user={u} sub={`${u.followers} followers`} action={<FollowButton username={u.username} initial="NONE" />} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
