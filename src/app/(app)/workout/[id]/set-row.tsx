"use client";

import { Check } from "lucide-react";
import { NumberInput } from "@/components/ui/form";
import { cn } from "@/lib/client/cn";
import { displayToKg, formatDuration, kgToDisplay, round, trim, type UnitSystem } from "@/lib/client/format";
import type { ExerciseState, SetState } from "./recorder-state";

const TYPE_CYCLE = ["NORMAL", "WARMUP", "DROP", "FAILURE"];
const TYPE_LABEL: Record<string, string> = { NORMAL: "", WARMUP: "W", DROP: "D", FAILURE: "F" };
const TYPE_NAME: Record<string, string> = { NORMAL: "Normal set", WARMUP: "Warm-up", DROP: "Drop set", FAILURE: "To failure" };

const cell = "h-11 w-full rounded-lg border-transparent bg-surface-2 px-1 text-center text-base font-semibold focus:bg-surface-3";

export function previousText(prev: { weight: number | null; reps: number | null; durationSeconds: number | null; distance: number | null } | undefined, mode: string, units: UnitSystem) {
  if (!prev) return "–";
  if (mode === "WEIGHT_REPS") return prev.weight && prev.reps ? `${trim(round(kgToDisplay(prev.weight, units), 1))}×${prev.reps}` : "–";
  if (mode === "BODYWEIGHT_REPS") return prev.reps ? (prev.weight ? `+${trim(round(kgToDisplay(prev.weight, units), 1))}×${prev.reps}` : `${prev.reps} reps`) : "–";
  if (mode === "DURATION") return prev.durationSeconds ? formatDuration(prev.durationSeconds) : "–";
  return prev.distance ? `${trim(round(prev.distance, 2))} km` : "–";
}

export function columnsFor(mode: string, units: UnitSystem): Array<{ key: keyof SetState; label: string }> {
  const w = units === "imperial" ? "LB" : "KG";
  switch (mode) {
    case "BODYWEIGHT_REPS":
      return [{ key: "weight", label: `+${w}` }, { key: "reps", label: "REPS" }];
    case "DURATION":
      return [{ key: "durationSeconds", label: "MIN" }];
    case "DISTANCE_DURATION":
      return [{ key: "distance", label: "KM" }, { key: "durationSeconds", label: "MIN" }];
    default:
      return [{ key: "weight", label: w }, { key: "reps", label: "REPS" }];
  }
}

export function SetRow({
  index,
  set,
  exercise,
  units,
  onChange,
  onToggle,
}: {
  index: number;
  set: SetState;
  exercise: ExerciseState;
  units: UnitSystem;
  onChange: (patch: Partial<SetState>) => void;
  onToggle: () => void;
}) {
  const mode = exercise.exercise.trackingMode;
  const cols = columnsFor(mode, units);
  const prev = exercise.previous?.sets[index];
  const prevLabel = previousText(prev, mode, units);
  const label = TYPE_LABEL[set.setType];

  function usePrev() {
    if (!prev) return;
    onChange({ weight: prev.weight ?? set.weight, reps: prev.reps ?? set.reps, durationSeconds: prev.durationSeconds ?? set.durationSeconds, distance: prev.distance ?? set.distance });
  }

  return (
    <li className={cn("grid items-center gap-1.5 rounded-xl py-1 transition-colors", set.completed && "bg-accent-soft/60")} style={{ gridTemplateColumns: `2.25rem minmax(3.5rem,1fr) repeat(${cols.length}, minmax(0,1.2fr)) 2.75rem` }}>
      <button
        type="button"
        onClick={() => onChange({ setType: TYPE_CYCLE[(TYPE_CYCLE.indexOf(set.setType) + 1) % TYPE_CYCLE.length] })}
        aria-label={`Set ${index + 1}, ${TYPE_NAME[set.setType]}. Tap to change type`}
        className={cn("num flex h-11 items-center justify-center rounded-lg text-sm font-bold", set.setType === "WARMUP" ? "text-warning" : set.setType === "DROP" ? "text-info" : set.setType === "FAILURE" ? "text-danger" : "text-muted")}
      >
        {label || index + 1}
      </button>
      <button type="button" onClick={usePrev} disabled={!prev} title={prev ? "Use previous values" : undefined} aria-label={prev ? `Previous: ${prevLabel}. Tap to copy` : "No previous data"} className="num truncate rounded-lg px-1 text-center text-xs text-subtle hover:bg-surface-2 disabled:pointer-events-none">
        {prevLabel}
      </button>
      {cols.map(({ key, label: colLabel }) => {
        const raw = set[key] as number | null;
        const isWeight = key === "weight";
        const isTime = key === "durationSeconds";
        const display = raw === null ? null : isWeight ? round(kgToDisplay(raw, units), 2) : isTime ? round(raw / 60, 2) : raw;
        return (
          <NumberInput
            key={key}
            aria-label={`Set ${index + 1} ${colLabel.toLowerCase()}`}
            placeholder={prev ? (isWeight && prev.weight ? String(round(kgToDisplay(prev.weight, units), 1)) : key === "reps" && prev.reps ? String(prev.reps) : "0") : "0"}
            integer={key === "reps"}
            className={cell}
            value={display}
            onValue={(v) => onChange({ [key]: v === null ? null : isWeight ? Math.round(displayToKg(v, units) * 1000) / 1000 : isTime ? Math.round(v * 60) : v } as Partial<SetState>)}
          />
        );
      })}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={set.completed}
        aria-label={set.completed ? `Mark set ${index + 1} incomplete` : `Complete set ${index + 1}`}
        className={cn("flex h-11 w-11 items-center justify-center rounded-lg border transition-colors", set.completed ? "border-accent bg-accent text-accent-fg" : "border-line-strong text-subtle hover:border-accent hover:text-accent")}
      >
        <Check className="h-5 w-5" aria-hidden />
      </button>
    </li>
  );
}
