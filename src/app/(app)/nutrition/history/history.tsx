"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { NutritionNav } from "@/components/app/nutrition-nav";
import { PageHeader } from "@/components/app/page-header";
import { BarChart } from "@/components/charts/charts";
import { Card, ErrorState, SectionTitle, Skeleton, Stat } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/form";
import { get, qs } from "@/lib/client/api";
import { addDays, longDate, shortDate, todayLocal } from "@/lib/client/format";
import { grams, kcal, type HistoryData } from "@/lib/client/nutrition";

const RANGES = { "7": 6, "30": 29, "90": 89 } as const;

export function NutritionHistory() {
  const [range, setRange] = useState<keyof typeof RANGES>("7");
  const to = todayLocal();
  const from = addDays(to, -RANGES[range]);
  const q = useQuery({ queryKey: ["nutrition", "history", from, to], queryFn: () => get<HistoryData>(`/nutrition/history${qs({ from, to })}`) });
  const d = q.data;

  return (
    <>
      <PageHeader title="History" actions={<Segmented label="Range" value={range} onChange={setRange} options={[{ value: "7", label: "7d" }, { value: "30", label: "30d" }, { value: "90", label: "90d" }]} />} />
      <NutritionNav />
      {q.isLoading ? <Skeleton className="h-72" /> : null}
      {q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : null}
      {d ? (
        <div className="space-y-6">
          <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-5">
            <Stat label="Avg kcal" value={kcal(d.averages.calories)} sub={d.goal ? `target ${kcal(d.goal.calorieTarget)}` : undefined} />
            <Stat label="Protein" value={grams(d.averages.proteinG)} />
            <Stat label="Carbs" value={grams(d.averages.carbsG)} />
            <Stat label="Fat" value={grams(d.averages.fatG)} />
            <Stat label="Days logged" value={`${d.averages.loggedDays}/${d.days.length}`} />
          </Card>
          <section>
            <SectionTitle>Calories per day</SectionTitle>
            <Card className="p-4"><BarChart data={d.days.map((x) => ({ x: x.date, y: x.calories }))} unit=" kcal" label="Calories per day" formatX={shortDate} /></Card>
          </section>
          <section>
            <SectionTitle>Days</SectionTitle>
            <Card className="divide-y divide-line">
              {[...d.days].reverse().filter((x) => x.entries > 0).map((x) => (
                <Link key={x.date} href={`/nutrition?date=${x.date}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className="text-sm font-medium">{longDate(`${x.date}T12:00:00`)}</span>
                  <span className="num text-sm text-muted">P {Math.round(x.proteinG)} · C {Math.round(x.carbsG)} · F {Math.round(x.fatG)}</span>
                  <span className="num font-semibold">{kcal(x.calories)}</span>
                </Link>
              ))}
              {d.averages.loggedDays === 0 ? <p className="px-4 py-8 text-center text-sm text-muted">Nothing logged in this range.</p> : null}
            </Card>
          </section>
        </div>
      ) : null}
    </>
  );
}
