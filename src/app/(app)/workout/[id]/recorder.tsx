"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudCheck, CloudOff, Flag, Loader2, MoreVertical, Plus, Timer, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ExercisePicker } from "@/components/app/exercise-picker";
import { Button } from "@/components/ui/button";
import { Card, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Dialog, toast } from "@/components/ui/overlay";
import { ApiClientError, get, post } from "@/lib/client/api";
import { errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { clock, formatVolume, pluralize, titleCase } from "@/lib/client/format";
import { useUnits } from "@/lib/client/hooks";
import type { Exercise, Workout } from "@/lib/client/types";
import { RECORD_TYPE_LABELS, type RecordType } from "@/lib/constants";
import { blankSet, draftKey, fromWorkout, newId, nowMs, toPayload, useAutosave, type ExerciseState, type RecorderState, type SetState } from "./recorder-state";
import { RestTimer } from "./rest-timer";
import { columnsFor, SetRow } from "./set-row";

const DEFAULT_REST = 90;

type CompleteResult = { workout: Workout; prs: Array<{ exerciseId: string; exerciseName: string; recordType: string; value: number; previousValue: number; unit: string }>; alreadyCompleted: boolean };

export function Recorder({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const units = useUnits();
  const query = useQuery({ queryKey: ["workout", id], queryFn: () => get<Workout>(`/workouts/${id}`), staleTime: Infinity, refetchOnWindowFocus: false });

  const [serverState, setServerState] = useState<RecorderState | null>(null);
  const [state, setState] = useState<RecorderState | null>(null);
  const [picker, setPicker] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [menu, setMenu] = useState(false);
  const [result, setResult] = useState<CompleteResult | null>(null);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Hydrate from the server, preferring an unsynced local draft (crash / offline recovery).
  useEffect(() => {
    const w = query.data;
    if (!w || state) return;
    if (w.status === "COMPLETED") {
      router.replace(`/workouts/${w.id}`);
      return;
    }
    const base = fromWorkout(w);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from the server (and local draft)
    setServerState(base);
    try {
      const raw = localStorage.getItem(draftKey(id));
      if (raw) {
        const draft = JSON.parse(raw) as RecorderState;
        // Previous-performance hints come from the server; drafts only carry edits.
        const hints = new Map(base.exercises.map((e) => [e.id, e.previous]));
        setState({ ...draft, exercises: draft.exercises.map((e) => ({ ...e, previous: hints.get(e.id) ?? e.previous })) });
        toast.info("Restored your unsaved changes");
        return;
      }
    } catch {
      localStorage.removeItem(draftKey(id));
    }
    setState(base);
  }, [query.data, state, id, router]);

  const { status, saveNow } = useAutosave(id, state, serverState);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Warn before leaving with unsynced edits.
  useEffect(() => {
    if (status === "saved") return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  const totals = useMemo(() => {
    let sets = 0;
    let volume = 0;
    for (const e of state?.exercises ?? []) for (const s of e.sets) if (s.completed) { sets++; volume += (s.weight ?? 0) * (s.reps ?? 0); }
    return { sets, volume };
  }, [state]);

  if (query.isError) {
    const gone = query.error instanceof ApiClientError && query.error.status === 404;
    return <ErrorState message={gone ? "This workout no longer exists." : query.error.message} onRetry={gone ? () => router.replace("/workout/new") : () => query.refetch()} />;
  }
  if (!query.data || !state) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-16" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const startedAt = Date.parse(query.data.startedAt);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const update = (fn: (s: RecorderState) => RecorderState) => setState((s) => (s ? fn(s) : s));
  const updateExercise = (exId: string, fn: (e: ExerciseState) => ExerciseState) => update((s) => ({ ...s, exercises: s.exercises.map((e) => (e.id === exId ? fn(e) : e)) }));

  function addExercises(list: Exercise[]) {
    update((s) => ({
      ...s,
      exercises: [
        ...s.exercises,
        ...list.map<ExerciseState>((ex) => ({
          id: newId(),
          exerciseId: ex.id,
          exercise: { id: ex.id, name: ex.name, primaryMuscleGroup: ex.primaryMuscleGroup, equipment: ex.equipment, trackingMode: ex.trackingMode, exerciseType: ex.exerciseType },
          notes: null,
          restSeconds: null,
          previous: null,
          sets: [blankSet()],
        })),
      ],
    }));
    void refreshHints();
  }

  /** Previous-performance hints are computed server-side; pull them for freshly added exercises. */
  async function refreshHints() {
    try {
      await saveNow();
      const w = await get<Workout>(`/workouts/${id}`);
      const hints = new Map(w.exercises.map((e) => [e.id, e.previous ?? null]));
      setState((s) => (s ? { ...s, exercises: s.exercises.map((e) => (hints.has(e.id) && !e.previous ? { ...e, previous: hints.get(e.id)! } : e)) } : s));
    } catch {
      /* hints are optional */
    }
  }

  function toggleSet(ex: ExerciseState, set: SetState) {
    const completed = !set.completed;
    updateExercise(ex.id, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === set.id ? { ...s, completed } : s)) }));
    if (completed) setRestEnd(nowMs() + (ex.restSeconds ?? DEFAULT_REST) * 1000);
  }

  async function finish() {
    if (!state) return;
    setFinishing(true);
    try {
      const res = await post<CompleteResult>(`/workouts/${id}/complete`, toPayload(state));
      localStorage.removeItem(draftKey(id));
      qc.setQueryData(["active-workout"], null);
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
      setConfirmFinish(false);
      setResult(res);
    } catch (e) {
      toast.error(errorMessage(e));
      setConfirmFinish(false);
    } finally {
      setFinishing(false);
    }
  }

  async function discard() {
    try {
      await post(`/workouts/${id}/discard`);
      localStorage.removeItem(draftKey(id));
      qc.setQueryData(["active-workout"], null);
      router.replace("/feed");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  const SaveIcon = status === "saved" ? CloudCheck : status === "error" ? CloudOff : Loader2;
  const incomplete = state.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.completed && (s.reps || s.weight || s.durationSeconds || s.distance)).length, 0);

  return (
    <div className="pb-24">
      {/* Sticky header: title, clock, totals, finish */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <Input aria-label="Workout title" value={state.title} onChange={(e) => update((s) => ({ ...s, title: e.target.value }))} maxLength={120} className="display h-10 border-transparent bg-transparent px-0 text-3xl focus:bg-transparent" />
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
              <span className="num font-semibold text-fg" aria-label="Elapsed time">{clock(elapsed)}</span>
              <span className="num">{pluralize(totals.sets, "set")}</span>
              <span className="num">{formatVolume(totals.volume, units)}</span>
              <span className={cn("flex items-center gap-1", status === "error" && "text-danger")} role="status" aria-live="polite">
                <SaveIcon className={cn("h-3.5 w-3.5", status === "saving" && "animate-spin")} aria-hidden />
                {status === "saved" ? "Saved" : status === "saving" ? "Saving" : status === "error" ? "Offline, will retry" : "Unsaved"}
              </span>
            </p>
          </div>
          <div className="relative">
            <button type="button" aria-label="Workout options" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
              <MoreVertical className="h-5 w-5" aria-hidden />
            </button>
            {menu ? (
              <>
                <button type="button" aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
                <div role="menu" className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-line-strong bg-surface-2 py-1 shadow-card">
                  <button role="menuitem" type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-danger hover:bg-surface-3" onClick={() => { setMenu(false); setConfirmDiscard(true); }}>
                    <Trash2 className="h-4 w-4" aria-hidden /> Discard workout
                  </button>
                </div>
              </>
            ) : null}
          </div>
          <Button onClick={() => setConfirmFinish(true)} disabled={totals.sets === 0}>
            <Flag className="h-4 w-4" aria-hidden /> Finish
          </Button>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {state.exercises.length === 0 ? (
          <Card className="px-6 py-12 text-center">
            <h2 className="display text-3xl">Add your first exercise</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">Search 90+ exercises or create your own. Your sets autosave as you go.</p>
          </Card>
        ) : null}

        {state.exercises.map((ex) => {
          const cols = columnsFor(ex.exercise.trackingMode, units);
          return (
            <Card as="section" key={ex.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="display truncate text-2xl">
                    <Link href={`/exercises/${ex.exerciseId}`} className="hover:text-accent">
                      {ex.exercise.name}
                    </Link>
                  </h2>
                  <p className="text-xs text-subtle">
                    {titleCase(ex.exercise.primaryMuscleGroup)} · {titleCase(ex.exercise.equipment)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${ex.exercise.name}`}
                  onClick={() => update((s) => ({ ...s, exercises: s.exercises.filter((e) => e.id !== ex.id) }))}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-subtle hover:bg-danger-soft hover:text-danger"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="mt-3">
                <div className="grid gap-1.5 px-0 pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-subtle" style={{ gridTemplateColumns: `2.25rem minmax(3.5rem,1fr) repeat(${cols.length}, minmax(0,1.2fr)) 2.75rem` }} aria-hidden>
                  <span>Set</span>
                  <span>Prev</span>
                  {cols.map((c) => (
                    <span key={c.key}>{c.label}</span>
                  ))}
                  <span />
                </div>
                <ul className="space-y-1" aria-label={`${ex.exercise.name} sets`}>
                  {ex.sets.map((s, i) => (
                    <SetRow
                      key={s.id}
                      index={i}
                      set={s}
                      exercise={ex}
                      units={units}
                      onChange={(patch) => updateExercise(ex.id, (e) => ({ ...e, sets: e.sets.map((x) => (x.id === s.id ? { ...x, ...patch } : x)) }))}
                      onToggle={() => toggleSet(ex, s)}
                    />
                  ))}
                </ul>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <Button variant="secondary" size="sm" onClick={() => updateExercise(ex.id, (e) => ({ ...e, sets: [...e.sets, blankSet(e.sets[e.sets.length - 1])] }))}>
                  <Plus className="h-4 w-4" aria-hidden /> Add set
                </Button>
                {ex.sets.length > 1 ? (
                  <button type="button" className="text-xs font-medium text-subtle hover:text-danger" onClick={() => updateExercise(ex.id, (e) => ({ ...e, sets: e.sets.slice(0, -1) }))}>
                    Remove last set
                  </button>
                ) : null}
                <label className="ml-auto flex items-center gap-1.5 text-xs text-subtle">
                  <Timer className="h-3.5 w-3.5" aria-hidden />
                  <span className="sr-only">Rest seconds</span>
                  <input
                    inputMode="numeric"
                    aria-label={`Rest seconds for ${ex.exercise.name}`}
                    placeholder={String(DEFAULT_REST)}
                    value={ex.restSeconds ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      updateExercise(ex.id, (x) => ({ ...x, restSeconds: v ? Math.min(3600, Number(v)) : null }));
                    }}
                    className="num h-8 w-14 rounded-lg bg-surface-2 text-center text-xs text-fg"
                  />
                  s
                </label>
              </div>
            </Card>
          );
        })}

        <Button variant="outline" size="lg" className="w-full border-dashed" onClick={() => setPicker(true)}>
          <Plus className="h-5 w-5" aria-hidden /> Add exercise
        </Button>

        <Textarea aria-label="Workout notes" placeholder="Notes (private)" rows={2} maxLength={2000} value={state.notes} onChange={(e) => update((s) => ({ ...s, notes: e.target.value }))} />
      </div>

      {restEnd ? <RestTimer endsAt={restEnd} onAdjust={(d) => setRestEnd((t) => (t ? t + d * 1000 : t))} onDismiss={() => setRestEnd(null)} /> : null}

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={addExercises} />

      <ConfirmDialog
        open={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        onConfirm={async () => {
          await saveNow().catch(() => null);
          await finish();
        }}
        loading={finishing}
        title="Finish workout?"
        confirmLabel="Finish"
        message={
          <>
            {pluralize(totals.sets, "completed set")} · {formatVolume(totals.volume, units)}.
            {incomplete > 0 ? <span className="mt-2 block text-warning">{pluralize(incomplete, "set")} with data {incomplete === 1 ? "isn't" : "aren't"} ticked off and won&apos;t count.</span> : null}
          </>
        }
      />
      <ConfirmDialog open={confirmDiscard} onClose={() => setConfirmDiscard(false)} onConfirm={discard} danger title="Discard workout?" confirmLabel="Discard" message="This permanently deletes everything you logged in this session." />

      <Dialog open={result !== null} onClose={() => router.replace(`/workouts/${id}`)} title="Workout complete">
        {result ? (
          <div className="space-y-5 text-center">
            <p className="display text-6xl text-accent">{result.prs.length ? "New PR!" : "Nice work"}</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Time", clock(result.workout.durationSeconds ?? 0)],
                ["Volume", formatVolume(result.workout.stats?.volume ?? 0, units)],
                ["Sets", String(result.workout.stats?.setCount ?? 0)],
              ].map(([l, v]) => (
                <div key={l} className="rounded-xl bg-surface-2 py-3">
                  <p className="display num text-2xl">{v}</p>
                  <p className="text-[10px] uppercase tracking-wider text-subtle">{l}</p>
                </div>
              ))}
            </div>
            {result.prs.length ? (
              <ul className="space-y-1.5 text-left text-sm">
                {result.prs.map((p, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-lg bg-accent-soft px-3 py-2">
                    <span className="font-semibold">{p.exerciseName}</span>
                    <span className="num text-accent">{RECORD_TYPE_LABELS[p.recordType as RecordType] ?? titleCase(p.recordType)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={() => router.replace(`/workouts/${id}/publish`)}>Share to feed</Button>
              <Button variant="outline" onClick={() => router.replace(`/workouts/${id}`)}>
                View summary
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
