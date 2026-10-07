"use client";

import { Dumbbell, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CreateExercise } from "@/components/app/exercise-picker";
import { InfiniteList } from "@/components/app/infinite-list";
import { PageHeader } from "@/components/app/page-header";
import { WorkoutsNav } from "@/components/app/workouts-nav";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { cn } from "@/lib/client/cn";
import { titleCase } from "@/lib/client/format";
import { useList } from "@/lib/client/hooks";
import type { Exercise } from "@/lib/client/types";
import { MUSCLE_GROUPS } from "@/lib/constants";

export function ExerciseLibrary() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [muscle, setMuscle] = useState("");
  const [mine, setMine] = useState(false);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const list = useList<Exercise>(["exercises"], "/exercises", { q: debounced || undefined, muscle: muscle || undefined, mine: mine ? "true" : undefined, limit: 30 });

  return (
    <>
      <PageHeader
        title="Exercises"
        subtitle="The library plus your custom moves."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Custom
          </Button>
        }
      />
      <WorkoutsNav />
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
        <Input aria-label="Search exercises" placeholder="Search exercises" className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Filters">
        <button type="button" aria-pressed={mine} onClick={() => setMine((v) => !v)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold", mine ? "border-accent bg-accent text-accent-fg" : "border-line text-muted")}>
          My exercises
        </button>
        {["", ...MUSCLE_GROUPS].map((m) => (
          <button key={m || "all"} type="button" aria-pressed={muscle === m} onClick={() => setMuscle(m)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold", muscle === m ? "border-accent bg-accent text-accent-fg" : "border-line text-muted hover:text-fg")}>
            {m ? titleCase(m) : "All"}
          </button>
        ))}
      </div>
      <InfiniteList
        as="div"
        className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface"
        list={list}
        items={list.items}
        skeleton={<Skeleton className="h-16" />}
        empty={<EmptyState icon={<Dumbbell className="h-7 w-7" aria-hidden />} title="No exercises found" description="Try a different search, or create a custom exercise." />}
        render={(e) => (
          <Link key={e.id} href={`/exercises/${e.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-2">
            {e.media[0]?.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- licensed exercise stills
              <img src={e.media[0].url} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover bg-surface-3" />
            ) : (
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-xs font-bold text-subtle">{titleCase(e.primaryMuscleGroup).slice(0, 2)}</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{e.name}</p>
              <p className="truncate text-xs text-subtle">
                {titleCase(e.primaryMuscleGroup)} · {titleCase(e.equipment)}
              </p>
            </div>
            {e.isMine ? <Badge tone="accent">Custom</Badge> : null}
          </Link>
        )}
      />
      <Dialog open={creating} onClose={() => setCreating(false)} title="New exercise">
        <CreateExercise initialName="" onCancel={() => setCreating(false)} onCreated={(e) => router.push(`/exercises/${e.id}`)} />
      </Dialog>
    </>
  );
}
