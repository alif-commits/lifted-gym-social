"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Copy, Dumbbell, Flame, ListChecks, Moon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, ErrorState, SectionTitle, Skeleton, Spinner } from "@/components/ui/feedback";
import { toast } from "@/components/ui/overlay";
import { ApiClientError, get, post, type Page } from "@/lib/client/api";
import { errorMessage } from "@/lib/client/api";
import { pluralize, timeAgo } from "@/lib/client/format";
import type { Workout, WorkoutListEntry } from "@/lib/client/types";

type TemplateLite = { id: string; name: string; exercises: Array<{ name: string }> };
type Today =
  | null
  | { programName: string; state: "NOT_STARTED" | "COMPLETED" | "REST" | "WORKOUT"; day?: { id: string; name: string; exercises: Array<{ name: string; targetSets: number; targetReps: string }> } | null };

export function StartWorkout() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useSearchParams();
  const [starting, setStarting] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const active = useQuery({ queryKey: ["active-workout"], queryFn: () => get<Workout | null>("/workouts/active"), staleTime: 0 });
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => get<TemplateLite[]>("/templates") });
  const today = useQuery({ queryKey: ["program-today"], queryFn: () => get<Today>("/programs/today") });
  const recent = useQuery({ queryKey: ["workouts", "recent"], queryFn: () => get<Page<WorkoutListEntry>>("/workouts?limit=3") });

  async function start(key: string, body: Record<string, unknown> = {}) {
    setStarting(key);
    try {
      const w = await post<Workout>("/workouts", body);
      qc.setQueryData(["active-workout"], w);
      router.replace(`/workout/${w.id}`);
    } catch (e) {
      if (e instanceof ApiClientError && e.code === "ACTIVE_WORKOUT_EXISTS") {
        const id = (e.details as unknown as { workoutId?: string } | undefined)?.workoutId;
        router.replace(id ? `/workout/${id}` : "/feed");
        return;
      }
      toast.error(errorMessage(e));
      setStarting(null);
    }
  }

  // Resume an in-progress workout instead of offering to start another.
  useEffect(() => {
    if (!active.data) return;
    const exercise = params.get("exercise");
    router.replace(exercise ? `/workout/${active.data.id}?add=${exercise}` : `/workout/${active.data.id}`);
  }, [active.data, params, router]);

  // Deep links: /workout/new?template=…, ?repeat=…, ?programDay=…, ?exercise=…
  useEffect(() => {
    if (autoStarted.current || active.isLoading || active.data) return;
    const template = params.get("template");
    const repeat = params.get("repeat");
    const day = params.get("programDay");
    const exercise = params.get("exercise");
    const body: Record<string, unknown> | null = template
      ? { templateId: template }
      : repeat
        ? { repeatWorkoutId: repeat }
        : day
          ? { programDayId: day }
          : exercise
            ? { exerciseIds: [exercise] }
            : null;
    if (body) {
      autoStarted.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deep links start a workout once, as an effect of the URL
      start("deep", body);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when the active-workout lookup settles
  }, [active.isLoading, active.data]);

  if (active.isLoading || active.data || starting === "deep") {
    return (
      <div className="flex min-h-[50dvh] items-center justify-center">
        <Spinner className="h-8 w-8" label="Loading your workout" />
      </div>
    );
  }
  if (active.isError) return <ErrorState message={active.error.message} onRetry={() => active.refetch()} />;

  const day = today.data?.state === "WORKOUT" ? today.data.day : null;
  const last = recent.data?.items[0];

  return (
    <>
      <PageHeader title="Start workout" subtitle="Pick a plan or go freestyle." />

      <Button size="lg" className="mb-6 h-16 w-full text-lg" loading={starting === "empty"} disabled={starting !== null} onClick={() => start("empty")}>
        <Dumbbell className="h-6 w-6" aria-hidden /> Empty workout
      </Button>

      {today.data ? (
        <section className="mb-8">
          <SectionTitle>Today&apos;s plan</SectionTitle>
          <Card className="p-5">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-subtle">
              <CalendarCheck className="h-4 w-4" aria-hidden /> {today.data.programName}
            </p>
            {day ? (
              <>
                <h3 className="display mt-2 text-3xl">{day.name}</h3>
                <p className="mt-1 text-sm text-muted">{day.exercises.map((e) => `${e.targetSets}×${e.targetReps} ${e.name}`).slice(0, 4).join(" · ")}</p>
                <Button className="mt-4" loading={starting === "day"} disabled={starting !== null} onClick={() => start("day", { programDayId: day.id })}>
                  <Flame className="h-4 w-4" aria-hidden /> Start today&apos;s session
                </Button>
              </>
            ) : (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                <Moon className="h-4 w-4" aria-hidden />
                {today.data.state === "REST" ? "Rest day. Recover well." : today.data.state === "COMPLETED" ? "Program complete. Nice work." : "Your program hasn't started yet."}
              </p>
            )}
          </Card>
        </section>
      ) : null}

      {last ? (
        <section className="mb-8">
          <SectionTitle>Repeat</SectionTitle>
          <Card className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{last.title}</p>
              <p className="text-xs text-subtle">
                {timeAgo(last.startedAt)} · {pluralize(last.exerciseCount, "exercise")}
              </p>
            </div>
            <Button variant="outline" loading={starting === "repeat"} disabled={starting !== null} onClick={() => start("repeat", { repeatWorkoutId: last.id })}>
              <Copy className="h-4 w-4" aria-hidden /> Repeat
            </Button>
          </Card>
        </section>
      ) : null}

      <section>
        <SectionTitle>Templates</SectionTitle>
        {templates.isLoading ? (
          <Skeleton className="h-24" />
        ) : templates.data?.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {templates.data.map((t) => (
              <li key={t.id}>
                <button type="button" disabled={starting !== null} onClick={() => start(t.id, { templateId: t.id })} className="flex h-full w-full flex-col rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-accent disabled:opacity-60">
                  <span className="flex items-center gap-2 font-semibold">
                    <ListChecks className="h-4 w-4 text-accent" aria-hidden /> {t.name}
                  </span>
                  <span className="mt-1 line-clamp-2 text-xs text-muted">{t.exercises.map((e) => e.name).join(", ") || "No exercises"}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No templates yet. Finish a workout and save it as one.</p>
        )}
      </section>
    </>
  );
}
