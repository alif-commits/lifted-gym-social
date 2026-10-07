"use client";

import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import Link from "next/link";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { get } from "@/lib/client/api";
import { formatRecordValue, shortDate, titleCase } from "@/lib/client/format";
import { useUnits } from "@/lib/client/hooks";
import { RECORD_TYPE_LABELS, type RecordType } from "@/lib/constants";

type Rec = { id: string; exerciseId: string; exerciseName: string; recordType: RecordType; value: number; previousValue: number | null; unit: string; achievedAt: string; workoutId: string };

export function RecordsTab() {
  const units = useUnits();
  const q = useQuery({ queryKey: ["progress", "records"], queryFn: () => get<Rec[]>("/progress/records") });
  if (q.isLoading) return <Skeleton className="h-64" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  if (!q.data?.length) return <EmptyState icon={<Trophy className="h-7 w-7" aria-hidden />} title="No records yet" description="Your first workout sets baselines. Beat them to log PRs." />;
  return (
    <Card className="divide-y divide-line">
      {q.data.map((r) => (
        <Link key={r.id} href={`/workouts/${r.workoutId}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
          <Trophy className={`h-5 w-5 shrink-0 ${r.previousValue ? "text-accent" : "text-subtle"}`} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{r.exerciseName}</span>
            <span className="block text-xs text-subtle">{RECORD_TYPE_LABELS[r.recordType] ?? titleCase(r.recordType)} · {shortDate(r.achievedAt)}{r.previousValue ? "" : " · baseline"}</span>
          </span>
          <span className="num font-semibold">{formatRecordValue(r.value, r.unit, units)}</span>
        </Link>
      ))}
    </Card>
  );
}
