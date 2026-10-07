"use client";

import { useQuery } from "@tanstack/react-query";
import { Dumbbell, Hash, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ActivityCard } from "@/components/app/activity-card";
import { PageHeader } from "@/components/app/page-header";
import { PersonRow } from "@/components/app/person-row";
import { Card, EmptyState, ErrorState, SectionTitle, Skeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { get, qs } from "@/lib/client/api";
import type { ActivityCard as ActivityCardT, Exercise, UserSummary } from "@/lib/client/types";

type Results = { users: Array<UserSummary & { isPrivate: boolean }>; activities: ActivityCardT[]; exercises: Exercise[]; hashtags: string[] };

export function SearchView() {
  const router = useRouter();
  const urlQ = useSearchParams().get("q") ?? "";
  const [input, setInput] = useState(urlQ);
  const [q, setQ] = useState(urlQ.trim());

  // Debounce typing, keep the URL shareable.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = input.trim();
      setQ(next);
      router.replace(next ? `/search${qs({ q: next })}` : "/search", { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [input, router]);

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["search", q],
    queryFn: ({ signal }) => get<Results>(`/search${qs({ q, limit: 8 })}`, signal),
    enabled: q.length > 0,
  });
  const nothing = data && !data.users.length && !data.activities.length && !data.exercises.length && !data.hashtags.length;

  return (
    <>
      <PageHeader title="Search" />
      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle" aria-hidden />
        <Input type="search" aria-label="Search athletes, workouts, exercises and hashtags" placeholder="Athletes, workouts, exercises, #tags" className="h-12 pl-12" value={input} onChange={(e) => setInput(e.target.value)} autoFocus />
      </div>

      {!q ? <EmptyState icon={<Search className="h-7 w-7" aria-hidden />} title="Find your people" description="Search for athletes by name, workouts by title, exercises and hashtags." /> : null}
      {q && isFetching && !data ? <Skeleton className="h-48" /> : null}
      {error ? <ErrorState message={error.message} onRetry={() => refetch()} /> : null}
      {nothing ? <EmptyState title={`No results for “${q}”`} description="Check the spelling or try something broader." /> : null}

      {data && !nothing ? (
        <div className="space-y-8" aria-live="polite">
          {data.users.length ? (
            <section>
              <SectionTitle>Athletes</SectionTitle>
              <Card className="divide-y divide-line px-4">
                {data.users.map((u) => (
                  <PersonRow key={u.id} user={u} sub={u.isPrivate ? `@${u.username} · Private` : `@${u.username}`} />
                ))}
              </Card>
            </section>
          ) : null}
          {data.hashtags.length ? (
            <section>
              <SectionTitle>Hashtags</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {data.hashtags.map((t) => (
                  <Link key={t} href={`/hashtag/${encodeURIComponent(t)}`} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium hover:border-accent hover:text-accent">
                    <Hash className="h-3.5 w-3.5" aria-hidden />
                    {t}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {data.exercises.length ? (
            <section>
              <SectionTitle>Exercises</SectionTitle>
              <Card className="divide-y divide-line">
                {data.exercises.map((e) => (
                  <Link key={e.id} href={`/exercises/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <Dumbbell className="h-4 w-4 text-subtle" aria-hidden />
                    <span className="font-medium">{e.name}</span>
                    <span className="ml-auto text-xs text-subtle">{e.primaryMuscleGroup.toLowerCase().replace(/_/g, " ")}</span>
                  </Link>
                ))}
              </Card>
            </section>
          ) : null}
          {data.activities.length ? (
            <section>
              <SectionTitle>Workouts</SectionTitle>
              <div className="space-y-4">
                {data.activities.map((a) => (
                  <ActivityCard key={a.id} activity={a} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
