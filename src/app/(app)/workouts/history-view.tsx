"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Dumbbell, FileEdit, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { InfiniteList } from "@/components/app/infinite-list";
import { PageHeader } from "@/components/app/page-header";
import { WorkoutsNav } from "@/components/app/workouts-nav";
import { CalendarHeatmap } from "@/components/charts/charts";
import { ButtonLink, IconButton } from "@/components/ui/button";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Tabs } from "@/components/ui/tabs";
import { get, qs } from "@/lib/client/api";
import { formatDuration, formatVolume, longDate, pluralize, todayLocal } from "@/lib/client/format";
import { useList, useUnits } from "@/lib/client/hooks";
import type { WorkoutListEntry } from "@/lib/client/types";

type Calendar = { days: Record<string, Array<{ id: string; title: string; volumeKg: number | null; durationSeconds: number | null }>> };

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}
const shiftMonth = (month: string, d: number) => {
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + d, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
};

export function WorkoutRow({ w }: { w: WorkoutListEntry }) {
  const units = useUnits();
  return (
    <li>
      <Link href={`/workouts/${w.id}`} className="block rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="display truncate text-2xl">{w.title}</h3>
            <p className="text-xs text-subtle">{longDate(w.startedAt)}</p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {w.prCount > 0 ? (
              <Badge tone="accent">
                <Trophy className="h-3 w-3" aria-hidden /> {w.prCount}
              </Badge>
            ) : null}
            {w.source === "STRAVA" ? <Badge>Strava</Badge> : null}
            {w.activityStatus === "PUBLISHED" ? <Badge tone="success">Shared</Badge> : w.activityStatus === "DRAFT" ? <Badge tone="warning">Draft</Badge> : null}
          </div>
        </div>
        <p className="num mt-2 text-sm text-muted">
          {formatDuration(w.durationSeconds)} · {pluralize(w.exerciseCount, "exercise")} · {pluralize(w.setCount, "set")} · {formatVolume(w.volume, units)}
        </p>
      </Link>
    </li>
  );
}

export function HistoryView() {
  const [tab, setTab] = useState<"list" | "calendar">("list");
  const [month, setMonth] = useState(() => todayLocal().slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const list = useList<WorkoutListEntry>(["workouts", "list"], "/workouts", {}, tab === "list");
  const range = monthRange(month);
  const cal = useQuery({ queryKey: ["workouts", "calendar", month], queryFn: () => get<Calendar>(`/progress/calendar${qs(range)}`), enabled: tab === "calendar" });
  const counts = Object.fromEntries(Object.entries(cal.data?.days ?? {}).map(([d, v]) => [d, v.length]));
  const dayItems = selected ? (cal.data?.days[selected] ?? []) : [];

  return (
    <>
      <PageHeader
        title="Workouts"
        subtitle="Everything you've lifted."
        actions={
          <ButtonLink href="/workout/new">
            <Dumbbell className="h-4 w-4" aria-hidden /> New workout
          </ButtonLink>
        }
      />
      <WorkoutsNav />
      <Tabs label="Workout views" value={tab} onChange={setTab} tabs={[{ value: "list", label: "History" }, { value: "calendar", label: "Calendar" }]} className="mb-5" />

      {tab === "list" ? (
        <InfiniteList
          as="ul"
          list={list}
          items={list.items}
          skeleton={<Skeleton className="h-24" />}
          render={(w) => <WorkoutRow key={w.id} w={w} />}
          empty={<EmptyState icon={<FileEdit className="h-7 w-7" aria-hidden />} title="No workouts yet" description="Finish your first session and it will appear here." action={<ButtonLink href="/workout/new">Start a workout</ButtonLink>} />}
        />
      ) : (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <IconButton label="Previous month" onClick={() => { setMonth((m) => shiftMonth(m, -1)); setSelected(null); }}>
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </IconButton>
            <h2 className="display text-2xl" aria-live="polite">
              {new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}
            </h2>
            <IconButton label="Next month" onClick={() => { setMonth((m) => shiftMonth(m, 1)); setSelected(null); }}>
              <ChevronRight className="h-5 w-5" aria-hidden />
            </IconButton>
          </div>
          {cal.isLoading ? <Skeleton className="h-64" /> : <CalendarHeatmap month={month} days={counts} selected={selected} onSelect={setSelected} />}
          {selected ? (
            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-2 text-sm font-semibold">{longDate(`${selected}T12:00:00`)}</p>
              {dayItems.length ? (
                <ul className="space-y-2">
                  {dayItems.map((d) => (
                    <li key={d.id}>
                      <Link href={`/workouts/${d.id}`} className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 hover:bg-surface-3">
                        <span className="font-medium">{d.title}</span>
                        <span className="num text-xs text-muted">{formatDuration(d.durationSeconds)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Rest day.</p>
              )}
            </div>
          ) : null}
        </Card>
      )}
    </>
  );
}
