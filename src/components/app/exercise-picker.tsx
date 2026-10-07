"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { Dialog, toast } from "@/components/ui/overlay";
import { errorMessage, post } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { titleCase } from "@/lib/client/format";
import { useList } from "@/lib/client/hooks";
import type { Exercise } from "@/lib/client/types";
import { EQUIPMENT, MUSCLE_GROUPS, TRACKING_MODES } from "@/lib/constants";

const TRACKING_LABEL: Record<string, string> = { WEIGHT_REPS: "Weight × reps", BODYWEIGHT_REPS: "Bodyweight reps", DURATION: "Duration", DISTANCE_DURATION: "Distance + time" };

/** Searchable, filterable exercise chooser with inline custom-exercise creation. */
export function ExercisePicker({ open, onClose, onPick, multiple = true, confirmLabel = "Add" }: { open: boolean; onClose: () => void; onPick: (exercises: Exercise[]) => void; multiple?: boolean; confirmLabel?: string }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [muscle, setMuscle] = useState("");
  const [selected, setSelected] = useState<Exercise[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const list = useList<Exercise>(["exercise-picker"], "/exercises", { q: debounced || undefined, muscle: muscle || undefined, limit: 30 }, open);

  function close() {
    setSelected([]);
    setCreating(false);
    onClose();
  }
  function toggle(e: Exercise) {
    if (!multiple) {
      onPick([e]);
      close();
      return;
    }
    setSelected((s) => (s.some((x) => x.id === e.id) ? s.filter((x) => x.id !== e.id) : [...s, e]));
  }

  return (
    <Dialog open={open} onClose={close} title={creating ? "New exercise" : "Add exercises"} sheet className="sm:max-w-xl">
      {creating ? (
        <CreateExercise
          initialName={q}
          onCancel={() => setCreating(false)}
          onCreated={(e) => {
            setCreating(false);
            toggle(e);
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
            <Input aria-label="Search exercises" placeholder="Search exercises" className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]" role="group" aria-label="Filter by muscle group">
            {["", ...MUSCLE_GROUPS].map((m) => (
              <button key={m || "all"} type="button" aria-pressed={muscle === m} onClick={() => setMuscle(m)} className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold", muscle === m ? "border-accent bg-accent text-accent-fg" : "border-line text-muted hover:text-fg")}>
                {m ? titleCase(m) : "All"}
              </button>
            ))}
          </div>

          <ul className="-mx-2 max-h-[45dvh] min-h-40 divide-y divide-line overflow-y-auto" aria-label="Exercises">
            {list.isLoading ? (
              <li className="flex justify-center py-10">
                <Spinner />
              </li>
            ) : null}
            {list.items.map((e) => {
              const on = selected.some((x) => x.id === e.id);
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => toggle(e)} aria-pressed={multiple ? on : undefined} className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-surface-2">
                    <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", on ? "border-accent bg-accent text-accent-fg" : "border-line-strong")}>{on ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{e.name}</span>
                      <span className="block truncate text-xs text-subtle">
                        {titleCase(e.primaryMuscleGroup)} · {titleCase(e.equipment)}
                        {e.isMine ? " · Custom" : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!list.isLoading && list.items.length === 0 ? <li className="py-8 text-center text-sm text-muted">No exercises match.</li> : null}
            {list.hasNextPage ? (
              <li className="py-2 text-center">
                <Button variant="ghost" size="sm" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                  Load more
                </Button>
              </li>
            ) : null}
          </ul>

          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            <Button variant="ghost" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Custom exercise
            </Button>
            {multiple ? (
              <Button
                disabled={selected.length === 0}
                onClick={() => {
                  onPick(selected);
                  close();
                }}
              >
                {confirmLabel} {selected.length ? `(${selected.length})` : ""}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function CreateExercise({ initialName, onCreated, onCancel }: { initialName: string; onCreated: (e: Exercise) => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(initialName);
  const [primaryMuscleGroup, setMuscle] = useState<string>("CHEST");
  const [equipment, setEquipment] = useState<string>("BARBELL");
  const [trackingMode, setTracking] = useState<string>("WEIGHT_REPS");
  const [loading, setLoading] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (ev) => {
        ev.preventDefault();
        setLoading(true);
        try {
          const created = await post<Exercise>("/exercises", { name, primaryMuscleGroup, equipment, trackingMode, exerciseType: trackingMode === "DURATION" ? "TIMED" : trackingMode === "DISTANCE_DURATION" ? "CARDIO" : trackingMode === "BODYWEIGHT_REPS" ? "BODYWEIGHT" : "STRENGTH" });
          qc.invalidateQueries({ queryKey: ["exercise-picker"] });
          qc.invalidateQueries({ queryKey: ["exercises"] });
          onCreated(created);
        } catch (e) {
          toast.error(errorMessage(e));
        } finally {
          setLoading(false);
        }
      }}
    >
      <Field label="Name">{(p) => <Input {...p} required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Muscle group">
          {(p) => (
            <Select {...p} value={primaryMuscleGroup} onChange={(e) => setMuscle(e.target.value)}>
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m}>
                  {titleCase(m)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Equipment">
          {(p) => (
            <Select {...p} value={equipment} onChange={(e) => setEquipment(e.target.value)}>
              {EQUIPMENT.map((m) => (
                <option key={m} value={m}>
                  {titleCase(m)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Tracking">
        {(p) => (
          <Select {...p} value={trackingMode} onChange={(e) => setTracking(e.target.value)}>
            {TRACKING_MODES.map((m) => (
              <option key={m} value={m}>
                {TRACKING_LABEL[m]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Back
        </Button>
        <Button type="submit" loading={loading}>
          Create & add
        </Button>
      </div>
    </form>
  );
}
