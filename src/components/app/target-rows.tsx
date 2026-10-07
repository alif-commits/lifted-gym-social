"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, NumberInput } from "@/components/ui/form";
import { displayToKg, kgToDisplay, round, weightUnit } from "@/lib/client/format";
import { useUnits } from "@/lib/client/hooks";
import type { Exercise } from "@/lib/client/types";
import { ExercisePicker } from "./exercise-picker";

export type TargetRow = { key: string; exerciseId: string; name: string; targetSets: number | null; targetReps: string; targetWeight: number | null };

export const rowFromExercise = (e: Pick<Exercise, "id" | "name">): TargetRow => ({ key: crypto.randomUUID(), exerciseId: e.id, name: e.name, targetSets: 3, targetReps: "8-12", targetWeight: null });

/** Editable list of exercises with set/rep/weight targets, shared by templates and programs. */
export function TargetRows({ rows, onChange, label }: { rows: TargetRow[]; onChange: (rows: TargetRow[]) => void; label: string }) {
  const units = useUnits();
  const [picker, setPicker] = useState(false);
  const patch = (key: string, p: Partial<TargetRow>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...rows];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <ul className="space-y-2" aria-label={label}>
        {rows.map((r, i) => (
          <li key={r.key} className="rounded-xl bg-surface-2 p-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
              <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-surface-3 disabled:opacity-30"><ArrowUp className="h-4 w-4" aria-hidden /></button>
              <button type="button" aria-label="Move down" disabled={i === rows.length - 1} onClick={() => move(i, 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-surface-3 disabled:opacity-30"><ArrowDown className="h-4 w-4" aria-hidden /></button>
              <button type="button" aria-label={`Remove ${r.name}`} onClick={() => onChange(rows.filter((x) => x.key !== r.key))} className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-danger-soft hover:text-danger"><X className="h-4 w-4" aria-hidden /></button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-subtle">
                Sets
                <NumberInput integer aria-label={`${r.name} sets`} className="mt-1 h-10 text-center" value={r.targetSets} onValue={(v) => patch(r.key, { targetSets: v === null ? null : Math.min(30, Math.max(1, v)) })} />
              </label>
              <label className="text-[11px] font-medium uppercase tracking-wider text-subtle">
                Reps
                <Input aria-label={`${r.name} reps`} className="num mt-1 h-10 text-center" maxLength={24} placeholder="8-12" value={r.targetReps} onChange={(e) => patch(r.key, { targetReps: e.target.value })} />
              </label>
              <label className="text-[11px] font-medium uppercase tracking-wider text-subtle">
                {weightUnit(units)}
                <NumberInput aria-label={`${r.name} weight`} className="mt-1 h-10 text-center" value={r.targetWeight === null ? null : round(kgToDisplay(r.targetWeight, units), 2)} onValue={(v) => patch(r.key, { targetWeight: v === null ? null : Math.round(displayToKg(v, units) * 1000) / 1000 })} />
              </label>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="mt-3 w-full border-dashed" onClick={() => setPicker(true)}>
        <Plus className="h-4 w-4" aria-hidden /> Add exercise
      </Button>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(list) => onChange([...rows, ...list.map(rowFromExercise)])} />
    </div>
  );
}
