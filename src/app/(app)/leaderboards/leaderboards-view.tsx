"use client";

import { Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { get } from "@/lib/client/api";
import { formatDuration, formatVolume } from "@/lib/client/format";
import { useUnits } from "@/lib/client/hooks";
import { useQuery } from "@tanstack/react-query";
import type { UserSummary } from "@/lib/client/types";

type Metric = "workouts" | "time" | "volume" | "prs" | "days";
type Window = "week" | "month" | "all";
type Row = { rank: number; user: UserSummary; value: number; isMe: boolean };

const METRICS: Array<{ value: Metric; label: string }> = [
  { value: "workouts", label: "Workouts" },
  { value: "days", label: "Active days" },
  { value: "volume", label: "Volume" },
  { value: "time", label: "Time" },
  { value: "prs", label: "PRs" },
];

export function LeaderboardsView() {
  const units = useUnits();
  const [metric, setMetric] = useState<Metric>("workouts");
  const [window, setWindow] = useState<Window>("week");
  const q = useQuery({
    queryKey: ["leaderboards", metric, window],
    queryFn: () => get<{ items: Row[] }>(`/leaderboards?metric=${metric}&window=${window}`),
  });

  const format = (n: number) => {
    if (metric === "volume") return formatVolume(n, units);
    if (metric === "time") return formatDuration(n);
    return n.toLocaleString();
  };

  return (
    <>
      <PageHeader title="Friends" subtitle="Weekly and monthly rankings among people you follow. Consistency counts." />
      <Tabs
        label="Time window"
        value={window}
        onChange={setWindow}
        className="mb-4"
        tabs={[
          { value: "week", label: "This week" },
          { value: "month", label: "This month" },
          { value: "all", label: "All time" },
        ]}
      />
      <div className="mb-6 overflow-x-auto">
        <Segmented label="Leaderboard metric" value={metric} onChange={setMetric} options={METRICS} />
      </div>
      {q.isLoading ? <Skeleton className="h-64" /> : null}
      {q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : null}
      {q.data && q.data.items.length === 0 ? <EmptyState icon={<Trophy className="h-7 w-7" aria-hidden />} title="No friends yet" description="Follow athletes and finish workouts to show up here." /> : null}
      <ol className="space-y-2">
        {q.data?.items.map((row) => (
          <li key={row.user.id}>
            <Card className={`flex items-center gap-3 p-3 ${row.isMe ? "border-accent/40" : ""}`}>
              <span className="num w-7 text-center text-sm font-bold text-subtle">{row.rank}</span>
              <Avatar name={row.user.displayName} src={row.user.avatarUrl} size="sm" />
              <Link href={`/u/${row.user.username}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">
                {row.user.displayName} {row.isMe ? <span className="text-xs font-medium text-accent">You</span> : null}
              </Link>
              <span className="num text-sm font-semibold">{format(row.value)}</span>
            </Card>
          </li>
        ))}
      </ol>
    </>
  );
}
