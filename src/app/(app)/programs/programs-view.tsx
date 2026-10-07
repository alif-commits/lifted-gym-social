"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { WorkoutsNav } from "@/components/app/workouts-nav";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { ConfirmDialog, toast } from "@/components/ui/overlay";
import { del, errorMessage, get, post } from "@/lib/client/api";
import { pluralize } from "@/lib/client/format";

type ProgramListItem = { id: string; name: string; description: string | null; weeks: number; assigned: boolean };

export function ProgramsView() {
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<ProgramListItem | null>(null);
  const q = useQuery({ queryKey: ["programs"], queryFn: () => get<ProgramListItem[]>("/programs") });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["programs"] });
    qc.invalidateQueries({ queryKey: ["program-today"] });
  };
  const assign = useMutation({ mutationFn: (id: string) => post(`/programs/${id}/assign`), onSuccess: () => { refresh(); toast.success("Program started. Day 1 is today."); }, onError: (e) => toast.error(errorMessage(e)) });
  const unassign = useMutation({ mutationFn: () => del("/programs/today"), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/programs/${id}`), onSuccess: () => { refresh(); setToDelete(null); }, onError: (e) => toast.error(errorMessage(e)) });

  return (
    <>
      <PageHeader title="Programs" subtitle="Multi-week plans. Day 1 starts the day you begin." actions={<ButtonLink href="/programs/new"><Plus className="h-4 w-4" aria-hidden /> New program</ButtonLink>} />
      <WorkoutsNav />
      {q.isLoading ? <Skeleton className="h-40" /> : null}
      {q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : null}
      {q.data?.length === 0 ? <EmptyState icon={<CalendarRange className="h-7 w-7" aria-hidden />} title="No programs yet" description="Plan weeks of training, assign it, and each day's session shows up when you start a workout." action={<ButtonLink href="/programs/new">Build a program</ButtonLink>} /> : null}
      <ul className="space-y-3">
        {q.data?.map((p) => (
          <li key={p.id}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="display text-2xl">{p.name}</h2>
                  <p className="text-xs text-subtle">{pluralize(p.weeks, "week")}</p>
                  {p.description ? <p className="mt-1 text-sm text-muted">{p.description}</p> : null}
                </div>
                {p.assigned ? <Badge tone="accent">Active</Badge> : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {p.assigned ? (
                  <Button size="sm" variant="outline" loading={unassign.isPending} onClick={() => unassign.mutate()}>Stop program</Button>
                ) : (
                  <Button size="sm" loading={assign.isPending && assign.variables === p.id} onClick={() => assign.mutate(p.id)}>Start today</Button>
                )}
                <ButtonLink size="sm" variant="secondary" href={`/programs/${p.id}`}><Pencil className="h-4 w-4" aria-hidden /> Edit</ButtonLink>
                <Button size="sm" variant="ghost" className="ml-auto" aria-label={`Delete ${p.name}`} onClick={() => setToDelete(p)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <ConfirmDialog open={toDelete !== null} onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete.id)} loading={remove.isPending} danger title="Delete program?" confirmLabel="Delete" message={`“${toDelete?.name}” and its schedule will be removed.`} />
    </>
  );
}
