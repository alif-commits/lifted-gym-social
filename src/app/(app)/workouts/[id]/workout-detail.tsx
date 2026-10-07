"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, Copy, Share2, Trash2, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, ErrorState, Skeleton, Stat } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { ConfirmDialog, Dialog, toast } from "@/components/ui/overlay";
import { del, errorMessage, get, post } from "@/lib/client/api";
import { formatDuration, formatRecordValue, formatVolume, formatWeight, longDate, titleCase, trim } from "@/lib/client/format";
import { useUnits } from "@/lib/client/hooks";
import type { Workout } from "@/lib/client/types";
import { RECORD_TYPE_LABELS, type RecordType } from "@/lib/constants";

type Pr = { exerciseId: string; exerciseName: string; recordType: RecordType; value: number; previousValue: number; unit: string };

export function WorkoutDetail({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const units = useUnits();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveTpl, setSaveTpl] = useState(false);
  const [tplName, setTplName] = useState("");
  const w = useQuery({ queryKey: ["workout", id, "detail"], queryFn: () => get<Workout>(`/workouts/${id}`) });
  const prs = useQuery({ queryKey: ["workout", id, "prs"], queryFn: () => get<Pr[]>(`/workouts/${id}/prs`), enabled: w.data?.status === "COMPLETED" });

  const remove = useMutation({
    mutationFn: () => del(`/workouts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
      router.replace("/workouts");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const template = useMutation({
    mutationFn: () => post(`/workouts/${id}/save-template`, { name: tplName.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      setSaveTpl(false);
      toast.success("Saved as a template");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (w.isLoading) return <Skeleton className="h-96" />;
  if (w.isError) return <ErrorState message={w.error.message} onRetry={() => w.refetch()} />;
  const workout = w.data!;
  if (workout.status !== "COMPLETED") {
    router.replace(`/workout/${workout.id}`);
    return null;
  }

  const setLine = (s: Workout["exercises"][number]["sets"][number], mode: string) => {
    if (mode === "DURATION") return formatDuration(s.durationSeconds);
    if (mode === "DISTANCE_DURATION") return `${trim(s.distance ?? 0)} km · ${formatDuration(s.durationSeconds)}`;
    if (mode === "BODYWEIGHT_REPS") return s.weight ? `+${formatWeight(s.weight, units)} × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`;
    return `${formatWeight(s.weight, units)} × ${s.reps ?? 0}`;
  };

  return (
    <>
      <PageHeader
        title={workout.title}
        subtitle={longDate(workout.startedAt)}
        actions={
          workout.activityId ? (
            <ButtonLink href={`/workouts/${id}/publish`} variant="outline">
              <Share2 className="h-4 w-4" aria-hidden /> Edit post
            </ButtonLink>
          ) : (
            <ButtonLink href={`/workouts/${id}/publish`}>
              <Share2 className="h-4 w-4" aria-hidden /> Share
            </ButtonLink>
          )
        }
      />

      <Card className="mb-6 grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
        <Stat label="Time" value={formatDuration(workout.durationSeconds)} />
        <Stat label="Volume" value={formatVolume(workout.stats?.volume, units)} />
        <Stat label="Sets" value={workout.stats?.setCount ?? 0} sub={`${workout.stats?.repCount ?? 0} reps`} />
        <Stat label="Calories" value={workout.stats?.caloriesBurnedEstimate ?? "–"} sub="estimate" />
      </Card>

      {prs.data?.length ? (
        <Card className="mb-6 border-accent/40 p-5">
          <h2 className="display flex items-center gap-2 text-2xl text-accent">
            <Trophy className="h-5 w-5" aria-hidden /> Personal records
          </h2>
          <ul className="mt-3 space-y-2">
            {prs.data.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">
                  {p.exerciseName} <span className="text-subtle">· {RECORD_TYPE_LABELS[p.recordType] ?? titleCase(p.recordType)}</span>
                </span>
                <span className="num text-accent">
                  {formatRecordValue(p.value, p.unit, units)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="space-y-4">
        {workout.exercises.map((e) => (
          <Card as="section" key={e.id} className="p-4">
            <h2 className="display text-2xl">
              <Link href={`/exercises/${e.exerciseId}`} className="hover:text-accent">
                {e.exercise.name}
              </Link>
            </h2>
            <ol className="mt-2 divide-y divide-line">
              {e.sets.map((s, i) => (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="num w-10 text-subtle">{s.setType === "NORMAL" ? i + 1 : s.setType[0]}</span>
                  <span className={`num flex-1 ${s.completed ? "" : "text-subtle line-through"}`}>{setLine(s, e.exercise.trackingMode)}</span>
                </li>
              ))}
            </ol>
            {e.notes ? <p className="mt-2 text-xs text-muted">{e.notes}</p> : null}
          </Card>
        ))}
      </div>

      {workout.notes ? (
        <Card className="mt-4 p-4">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-subtle">Private notes</h2>
          <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{workout.notes}</p>
        </Card>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <ButtonLink href={`/workout/new?repeat=${id}`} variant="secondary">
          <Copy className="h-4 w-4" aria-hidden /> Repeat
        </ButtonLink>
        <Button variant="secondary" onClick={() => { setTplName(workout.title); setSaveTpl(true); }}>
          <BookmarkPlus className="h-4 w-4" aria-hidden /> Save as template
        </Button>
        <Button variant="danger" className="ml-auto" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" aria-hidden /> Delete
        </Button>
      </div>

      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => remove.mutate()} loading={remove.isPending} danger title="Delete workout?" confirmLabel="Delete" message="Your logged sets and records from this session are removed. A shared post keeps its summary." />
      <Dialog open={saveTpl} onClose={() => setSaveTpl(false)} title="Save as template">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); template.mutate(); }}>
          <Field label="Template name">{(p) => <Input {...p} value={tplName} onChange={(e) => setTplName(e.target.value)} maxLength={120} autoFocus />}</Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSaveTpl(false)}>Cancel</Button>
            <Button type="submit" loading={template.isPending}>Save</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
