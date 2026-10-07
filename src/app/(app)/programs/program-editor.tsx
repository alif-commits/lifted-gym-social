"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { TargetRows, type TargetRow } from "@/components/app/target-rows";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/overlay";
import { errorMessage, post, put } from "@/lib/client/api";

type Day = { key: string; name: string; rows: TargetRow[] };
type Week = { key: string; days: Day[] };
export type ProgramDto = {
  id: string;
  name: string;
  description: string | null;
  weeks: Array<{ days: Array<{ name: string; exercises: Array<{ exerciseId: string; name: string; targetSets: number; targetReps: string; targetWeight: number | null }> }> }>;
};

const uid = () => crypto.randomUUID();
const newDay = (n: number): Day => ({ key: uid(), name: `Day ${n}`, rows: [] });

export function ProgramEditor({ program }: { program?: ProgramDto }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState(program?.name ?? "");
  const [description, setDescription] = useState(program?.description ?? "");
  const [weeks, setWeeks] = useState<Week[]>(
    () =>
      program?.weeks.map((w) => ({
        key: uid(),
        days: w.days.map((d) => ({ key: uid(), name: d.name, rows: d.exercises.map((e) => ({ key: uid(), exerciseId: e.exerciseId, name: e.name, targetSets: e.targetSets, targetReps: e.targetReps, targetWeight: e.targetWeight })) })),
      })) ?? [{ key: uid(), days: [newDay(1)] }],
  );

  const setDay = (wk: string, dk: string, p: Partial<Day>) => setWeeks((ws) => ws.map((w) => (w.key === wk ? { ...w, days: w.days.map((d) => (d.key === dk ? { ...d, ...p } : d)) } : w)));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        weeks: weeks.map((w) => ({ days: w.days.map((d) => ({ name: d.name.trim() || "Workout", exercises: d.rows.map((r) => ({ exerciseId: r.exerciseId, targetSets: r.targetSets ?? 3, targetReps: r.targetReps.trim() || "8-12", targetWeight: r.targetWeight })) })) })),
      };
      return program ? put(`/programs/${program.id}`, body) : post("/programs", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["programs"] });
      qc.invalidateQueries({ queryKey: ["program-today"] });
      toast.success("Program saved");
      router.replace("/programs");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader title={program ? "Edit program" : "New program"} subtitle="Days run consecutively. Add a rest day by leaving a day's exercises empty." />
      <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Card className="space-y-4 p-5">
          <Field label="Name">{(p) => <Input {...p} required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Description" optional>{(p) => <Textarea {...p} rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />}</Field>
        </Card>

        {weeks.map((w, wi) => (
          <section key={w.key} aria-label={`Week ${wi + 1}`} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="display text-3xl">Week {wi + 1}</h2>
              {weeks.length > 1 ? (
                <Button variant="ghost" size="sm" onClick={() => setWeeks((ws) => ws.filter((x) => x.key !== w.key))}><Trash2 className="h-4 w-4" aria-hidden /> Remove week</Button>
              ) : null}
            </div>
            {w.days.map((d, di) => (
              <Card key={d.key} className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <span className="display num w-14 shrink-0 text-xl text-accent">D{di + 1}</span>
                  <Input aria-label={`Week ${wi + 1} day ${di + 1} name`} value={d.name} maxLength={80} onChange={(e) => setDay(w.key, d.key, { name: e.target.value })} />
                  <button type="button" aria-label={`Remove day ${di + 1}`} onClick={() => setWeeks((ws) => ws.map((x) => (x.key === w.key ? { ...x, days: x.days.filter((y) => y.key !== d.key) } : x)))} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-subtle hover:bg-danger-soft hover:text-danger"><Trash2 className="h-4 w-4" aria-hidden /></button>
                </div>
                <TargetRows rows={d.rows} onChange={(rows) => setDay(w.key, d.key, { rows })} label={`Week ${wi + 1} day ${di + 1} exercises`} />
              </Card>
            ))}
            {w.days.length < 7 ? (
              <Button variant="secondary" size="sm" onClick={() => setWeeks((ws) => ws.map((x) => (x.key === w.key ? { ...x, days: [...x.days, newDay(x.days.length + 1)] } : x)))}>
                <Plus className="h-4 w-4" aria-hidden /> Add day
              </Button>
            ) : null}
          </section>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {weeks.length < 16 ? (
            <Button variant="outline" onClick={() => setWeeks((ws) => [...ws, { key: uid(), days: ws[ws.length - 1].days.map((d) => ({ ...d, key: uid(), rows: d.rows.map((r) => ({ ...r, key: uid() })) })) }])}>
              <Plus className="h-4 w-4" aria-hidden /> Add week (copy last)
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" loading={save.isPending} disabled={!name.trim()}>Save program</Button>
          </div>
        </div>
      </form>
    </>
  );
}
