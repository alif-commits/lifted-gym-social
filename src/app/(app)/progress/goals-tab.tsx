"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { ExercisePicker } from "@/components/app/exercise-picker";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, ErrorState, ProgressBar, Skeleton } from "@/components/ui/feedback";
import { Field, Input, NumberInput, Select } from "@/components/ui/form";
import { ConfirmDialog, Dialog, toast } from "@/components/ui/overlay";
import { del, errorMessage, get, patch, post } from "@/lib/client/api";
import { displayToKg, formatWeight, longDate, round, weightUnit } from "@/lib/client/format";
import { useUnits } from "@/lib/client/hooks";
import type { UnitSystem } from "@/lib/client/format";

type Goal = { id: string; name: string; goalType: string; exerciseId: string | null; targetValue: number | null; targetUnit: string | null; startValue: number | null; targetDate: string | null; status: string; currentValue: number | null; percent: number | null };

const TYPE_LABEL: Record<string, string> = { BODY_WEIGHT: "Body weight", EXERCISE_1RM: "Lift a weight (1RM)", WORKOUT_FREQUENCY: "Workouts per week", CUSTOM: "Custom" };

function describe(g: Goal, units: UnitSystem) {
  const show = (v: number | null) => (v === null ? "–" : g.goalType === "BODY_WEIGHT" || g.goalType === "EXERCISE_1RM" ? formatWeight(v, units) : `${round(v, 1)}${g.targetUnit ? ` ${g.targetUnit}` : ""}`);
  return `${show(g.currentValue)} → ${show(g.targetValue)}`;
}

export function GoalsTab() {
  const units = useUnits();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Goal | null>(null);
  const q = useQuery({ queryKey: ["progress", "goals"], queryFn: () => get<Goal[]>("/progress/goals") });
  const refresh = () => qc.invalidateQueries({ queryKey: ["progress", "goals"] });
  const setStatus = useMutation({ mutationFn: ({ id, status }: { id: string; status: string }) => patch(`/progress/goals/${id}`, { status }), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/progress/goals/${id}`), onSuccess: () => { setToDelete(null); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" aria-hidden /> New goal</Button></div>
      {q.isLoading ? <Skeleton className="h-40" /> : null}
      {q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : null}
      {q.data?.length === 0 ? <EmptyState icon={<Target className="h-7 w-7" aria-hidden />} title="No goals yet" description="Pick a target weight, a lift or a weekly frequency and track your progress to it." action={<Button onClick={() => setCreating(true)}>Create a goal</Button>} /> : null}
      <ul className="space-y-3">
        {q.data?.map((g) => (
          <li key={g.id}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="display text-2xl">{g.name}</h3>
                  <p className="text-xs text-subtle">{TYPE_LABEL[g.goalType]}{g.targetDate ? ` · by ${longDate(`${g.targetDate}T12:00:00`)}` : ""}</p>
                </div>
                {g.status !== "ACTIVE" ? <Badge tone={g.status === "ACHIEVED" ? "success" : "neutral"}>{g.status === "ACHIEVED" ? "Achieved" : "Abandoned"}</Badge> : null}
              </div>
              <p className="num mt-2 text-sm text-muted">{describe(g, units)}</p>
              <div className="mt-2 flex items-center gap-3">
                <ProgressBar value={g.percent ?? 0} label={`${g.name} progress`} className="flex-1" />
                <span className="num w-10 text-right text-sm font-semibold">{g.percent ?? 0}%</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {g.status === "ACTIVE" ? <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: g.id, status: "ACHIEVED" })}><Check className="h-4 w-4" aria-hidden /> Mark achieved</Button> : <Button size="sm" variant="secondary" onClick={() => setStatus.mutate({ id: g.id, status: "ACTIVE" })}>Reopen</Button>}
                <Button size="sm" variant="ghost" className="ml-auto" aria-label={`Delete ${g.name}`} onClick={() => setToDelete(g)}><Trash2 className="h-4 w-4" aria-hidden /></Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <NewGoal open={creating} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refresh(); }} />
      <ConfirmDialog open={toDelete !== null} onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete.id)} loading={remove.isPending} danger title="Delete goal?" confirmLabel="Delete" message={`“${toDelete?.name}” will be removed.`} />
    </div>
  );
}

function NewGoal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const units = useUnits();
  const [type, setType] = useState("BODY_WEIGHT");
  const [name, setName] = useState("");
  const [target, setTarget] = useState<number | null>(null);
  const [unit, setUnit] = useState("");
  const [date, setDate] = useState("");
  const [exercise, setExercise] = useState<{ id: string; name: string } | null>(null);
  const [picker, setPicker] = useState(false);
  const weighted = type === "BODY_WEIGHT" || type === "EXERCISE_1RM";
  const latest = useQuery({ queryKey: ["progress", "weights", "latest"], queryFn: () => get<{ latestKg: number | null }>("/progress/weights?range=all"), enabled: open && type === "BODY_WEIGHT" });

  const create = useMutation({
    mutationFn: () =>
      post("/progress/goals", {
        name: name.trim() || (type === "EXERCISE_1RM" && exercise ? `${exercise.name} ${target}${weightUnit(units)}` : TYPE_LABEL[type]),
        goalType: type,
        exerciseId: type === "EXERCISE_1RM" ? exercise?.id : undefined,
        targetValue: target === null ? null : weighted ? Math.round(displayToKg(target, units) * 100) / 100 : target,
        targetUnit: weighted ? "kg" : type === "WORKOUT_FREQUENCY" ? "workouts" : unit || null,
        startValue: type === "BODY_WEIGHT" ? latest.data?.latestKg ?? null : type === "EXERCISE_1RM" ? 0 : type === "WORKOUT_FREQUENCY" ? 0 : null,
        targetDate: date || null,
      }),
    onSuccess: () => { setName(""); setTarget(null); setDate(""); setExercise(null); onCreated(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const valid = target !== null && (type !== "EXERCISE_1RM" || exercise);

  return (
    <Dialog open={open} onClose={onClose} title="New goal">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) create.mutate(); }}>
        <Field label="Goal type">{(p) => <Select {...p} value={type} onChange={(e) => setType(e.target.value)}>{Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>}</Field>
        {type === "EXERCISE_1RM" ? (
          <Field label="Exercise">{(p) => <button {...p} type="button" onClick={() => setPicker(true)} className="flex h-11 w-full items-center rounded-xl border border-line-strong bg-surface-2 px-3.5 text-left text-sm">{exercise?.name ?? "Choose an exercise"}</button>}</Field>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label={type === "WORKOUT_FREQUENCY" ? "Workouts / week" : weighted ? `Target (${weightUnit(units)})` : "Target value"}>{(p) => <NumberInput {...p} value={target} onValue={setTarget} />}</Field>
          {type === "CUSTOM" ? <Field label="Unit" optional>{(p) => <Input {...p} maxLength={16} value={unit} onChange={(e) => setUnit(e.target.value)} />}</Field> : <Field label="Target date" optional>{(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>}
        </div>
        <Field label="Name" optional>{(p) => <Input {...p} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hit 100 kg bench" />}</Field>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={create.isPending} disabled={!valid}>Create goal</Button></div>
      </form>
      <ExercisePicker open={picker} multiple={false} onClose={() => setPicker(false)} onPick={([e]) => setExercise({ id: e.id, name: e.name })} />
    </Dialog>
  );
}
