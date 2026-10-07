"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { LineChart } from "@/components/charts/charts";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState, ErrorState, SectionTitle, Skeleton } from "@/components/ui/feedback";
import { ConfirmDialog, toast } from "@/components/ui/overlay";
import { del, errorMessage, get, type Serialized } from "@/lib/client/api";
import { formatDuration, formatRecordValue, formatWeight, kgToDisplay, longDate, round, shortDate, titleCase, trim } from "@/lib/client/format";
import { useUnits } from "@/lib/client/hooks";
import { RECORD_TYPE_LABELS, type RecordType } from "@/lib/constants";
import type { exerciseHistory } from "@/server/services/exercises";

type History = Serialized<Awaited<ReturnType<typeof exerciseHistory>>>;

export function ExerciseDetail({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const units = useUnits();
  const [confirm, setConfirm] = useState(false);
  const q = useQuery({ queryKey: ["exercise-history", id], queryFn: () => get<History>(`/exercises/${id}/history`) });
  const remove = useMutation({
    mutationFn: () => del(`/exercises/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercises"] });
      router.replace("/exercises");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <Skeleton className="h-96" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const { exercise: ex, sessions, records } = q.data!;
  const e1rm = [...sessions].reverse().filter((s) => s.bestOneRm).map((s) => ({ x: s.date, y: round(kgToDisplay(s.bestOneRm!, units), 1) }));
  const mode = ex.trackingMode;

  return (
    <>
      <PageHeader
        title={ex.name}
        subtitle={`${titleCase(ex.primaryMuscleGroup)} · ${titleCase(ex.equipment)} · ${titleCase(ex.difficulty)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/workout/new?exercise=${ex.id}`}>
              <Play className="h-4 w-4" aria-hidden /> Add to workout
            </ButtonLink>
            {ex.isMine ? (
              <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>
                <Trash2 className="h-4 w-4" aria-hidden /> Delete
              </Button>
            ) : (
              <Badge>Library</Badge>
            )}
          </div>
        }
      />
      {ex.secondaryMuscles.length ? <p className="-mt-3 mb-5 text-sm text-muted">Also works: {ex.secondaryMuscles.map(titleCase).join(", ")}</p> : null}

      {ex.media[0]?.url ? (
        <Card className="mb-6 overflow-hidden">
          {ex.media[0].mediaType === "VIDEO" ? (
            <video src={ex.media[0].url} controls className="aspect-video w-full bg-black" playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- licensed remote/local exercise media
            <img src={ex.media[0].url} alt="" className="aspect-video w-full object-cover bg-surface-2" />
          )}
          {ex.media[0].attribution ? <p className="px-4 py-2 text-xs text-subtle">{ex.media[0].attribution}{ex.media[0].license ? ` · ${ex.media[0].license}` : ""}</p> : null}
        </Card>
      ) : null}

      {ex.description || ex.setupInstructions || ex.executionSteps.length || ex.breathingNotes || ex.commonMistakes.length || ex.instructions ? (
        <Card className="mb-6 space-y-5 p-5 text-sm">
          {ex.description ? <p>{ex.description}</p> : null}
          {ex.setupInstructions ? (
            <div>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-subtle">Setup</h2>
              <p className="whitespace-pre-wrap">{ex.setupInstructions}</p>
            </div>
          ) : null}
          {ex.executionSteps.length ? (
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">How to perform</h2>
              <ol className="list-decimal space-y-1.5 pl-5">
                {ex.executionSteps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          ) : null}
          {ex.breathingNotes ? (
            <div>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-subtle">Breathing</h2>
              <p>{ex.breathingNotes}</p>
            </div>
          ) : null}
          {ex.commonMistakes.length ? (
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Common mistakes</h2>
              <ul className="list-disc space-y-1 pl-5 text-muted">
                {ex.commonMistakes.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {!ex.executionSteps.length && ex.instructions ? <p className="whitespace-pre-wrap text-muted">{ex.instructions}</p> : null}
        </Card>
      ) : null}

      {records.length ? (
        <section className="mb-6">
          <SectionTitle>Personal records</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {records.map((r) => (
              <Card key={r.recordType} className="p-4">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-subtle">
                  <Trophy className="h-3.5 w-3.5 text-accent" aria-hidden /> {RECORD_TYPE_LABELS[r.recordType as RecordType] ?? titleCase(r.recordType)}
                </p>
                <p className="display num mt-1 text-3xl">{formatRecordValue(r.value, r.unit, units)}</p>
                <p className="text-xs text-subtle">{shortDate(r.achievedAt)}</p>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {e1rm.length > 1 ? (
        <section className="mb-6">
          <SectionTitle>Estimated 1RM</SectionTitle>
          <Card className="p-4">
            <LineChart points={e1rm} unit={units === "imperial" ? " lb" : " kg"} label="Estimated one-rep max over time" formatX={shortDate} />
          </Card>
        </section>
      ) : null}

      <section>
        <SectionTitle>History</SectionTitle>
        {sessions.length === 0 ? (
          <EmptyState title="No sessions yet" description="Log this exercise in a workout and your history shows up here." />
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <Card key={s.workoutId} className="p-4">
                <Link href={`/workouts/${s.workoutId}`} className="flex items-baseline justify-between gap-3 hover:text-accent">
                  <span className="font-semibold">{s.title}</span>
                  <span className="text-xs text-subtle">{longDate(s.date)}</span>
                </Link>
                <ul className="num mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                  {s.sets.map((x) => (
                    <li key={x.setNumber}>
                      {mode === "DURATION" ? formatDuration(x.durationSeconds) : mode === "DISTANCE_DURATION" ? `${trim(x.distance ?? 0)} km` : x.weight ? `${formatWeight(x.weight, units)} × ${x.reps ?? 0}` : `${x.reps ?? 0} reps`}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => remove.mutate()} loading={remove.isPending} danger title="Delete exercise?" confirmLabel="Delete" message="If it's in past workouts it is archived instead, so your history stays intact." />
    </>
  );
}
