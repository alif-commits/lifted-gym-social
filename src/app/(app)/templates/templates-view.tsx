"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { WorkoutsNav } from "@/components/app/workouts-nav";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { ConfirmDialog, toast } from "@/components/ui/overlay";
import { del, errorMessage, get } from "@/lib/client/api";
import { pluralize } from "@/lib/client/format";

export type TemplateDto = { id: string; name: string; description: string | null; exercises: Array<{ exerciseId: string; name: string; targetSets: number | null; targetReps: string | null; targetWeight: number | null }> };

export function TemplatesView() {
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<TemplateDto | null>(null);
  const q = useQuery({ queryKey: ["templates"], queryFn: () => get<TemplateDto[]>("/templates") });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      setToDelete(null);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader title="Templates" subtitle="Reusable workouts you can start in one tap." actions={<ButtonLink href="/templates/new"><Plus className="h-4 w-4" aria-hidden /> New template</ButtonLink>} />
      <WorkoutsNav />
      {q.isLoading ? <Skeleton className="h-40" /> : null}
      {q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : null}
      {q.data?.length === 0 ? <EmptyState icon={<ListChecks className="h-7 w-7" aria-hidden />} title="No templates yet" description="Build one here, or finish a workout and choose “Save as template”." action={<ButtonLink href="/templates/new">Create template</ButtonLink>} /> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {q.data?.map((t) => (
          <li key={t.id}>
            <Card className="flex h-full flex-col p-4">
              <h2 className="display text-2xl">{t.name}</h2>
              <p className="mt-1 line-clamp-2 flex-1 text-xs text-muted">{t.exercises.map((e) => e.name).join(", ") || "No exercises"}</p>
              <p className="mt-2 text-xs text-subtle">{pluralize(t.exercises.length, "exercise")}</p>
              <div className="mt-3 flex items-center gap-2">
                <ButtonLink href={`/workout/new?template=${t.id}`} size="sm"><Play className="h-4 w-4" aria-hidden /> Start</ButtonLink>
                <ButtonLink href={`/templates/${t.id}`} size="sm" variant="secondary"><Pencil className="h-4 w-4" aria-hidden /> Edit</ButtonLink>
                <Button size="sm" variant="ghost" className="ml-auto" aria-label={`Delete ${t.name}`} onClick={() => setToDelete(t)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <ConfirmDialog open={toDelete !== null} onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete.id)} loading={remove.isPending} danger title="Delete template?" confirmLabel="Delete" message={`“${toDelete?.name}” will be removed. Past workouts aren't affected.`} />
    </>
  );
}
