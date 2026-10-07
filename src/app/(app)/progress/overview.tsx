"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { useState } from "react";
import { BarChart, HBars, LineChart } from "@/components/charts/charts";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, ErrorState, SectionTitle, Skeleton, Stat } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/form";
import { get, type Serialized } from "@/lib/client/api";
import { formatDuration, formatVolume, kgToDisplay, round, shortDate, titleCase } from "@/lib/client/format";
import { useUnits } from "@/lib/client/hooks";
import type { getAnalytics } from "@/server/services/progress";

type Analytics = Serialized<Awaited<ReturnType<typeof getAnalytics>>>;
const RANGES = [{ value: "30d", label: "30d" }, { value: "90d", label: "90d" }, { value: "180d", label: "6m" }, { value: "365d", label: "1y" }, { value: "all", label: "All" }] as const;

export function Overview() {
  const units = useUnits();
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("90d");
  const q = useQuery({ queryKey: ["progress", "analytics", range], queryFn: () => get<Analytics>(`/progress/analytics?range=${range}`) });

  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const a = q.data!;
  const unit = units === "imperial" ? " lb" : " kg";

  return (
    <div className="space-y-6">
      <Segmented label="Time range" value={range} onChange={setRange} options={[...RANGES]} />
      {a.summary.workouts === 0 ? (
        <EmptyState icon={<Activity className="h-7 w-7" aria-hidden />} title="No data in this range" description="Finish a workout and your trends show up here." action={<ButtonLink href="/workout/new">Start a workout</ButtonLink>} />
      ) : (
        <>
          <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-5">
            <Stat label="Workouts" value={a.summary.workouts} sub={`${a.summary.perWeek}/week`} />
            <Stat label="Volume" value={formatVolume(a.summary.volumeKg, units)} />
            <Stat label="Time" value={formatDuration(a.summary.durationSeconds)} />
            <Stat label="PRs" value={a.summary.prs} />
            <Stat label="Streak" value={`${a.summary.streakWeeks}w`} />
          </Card>

          <section>
            <SectionTitle>Weekly volume</SectionTitle>
            <Card className="p-4"><BarChart data={a.weekly.map((w) => ({ x: w.week, y: round(kgToDisplay(w.volumeKg, units), 0) }))} unit={unit} label="Training volume per week" formatX={shortDate} /></Card>
          </section>
          <section>
            <SectionTitle>Workouts per week</SectionTitle>
            <Card className="p-4"><BarChart data={a.weekly.map((w) => ({ x: w.week, y: w.workouts }))} label="Workouts per week" formatX={shortDate} /></Card>
          </section>
          <section>
            <SectionTitle>Muscle split <span className="text-base text-subtle">(sets)</span></SectionTitle>
            <Card className="p-5"><HBars label="Sets per muscle group" data={a.muscleSplit.map((m) => ({ label: titleCase(m.muscle), value: m.sets }))} /></Card>
          </section>
          {a.strength.length ? (
            <section>
              <SectionTitle>Strength <span className="text-base text-subtle">(estimated 1RM)</span></SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                {a.strength.map((s) => (
                  <Card key={s.exerciseId} className="p-4">
                    <h3 className="mb-2 font-semibold">{s.name}</h3>
                    <LineChart points={s.series.map((p) => ({ x: p.date, y: round(kgToDisplay(p.e1rm, units), 1) }))} unit={unit} label={`${s.name} estimated one-rep max`} formatX={shortDate} />
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
