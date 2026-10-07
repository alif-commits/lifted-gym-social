"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { NutritionNav } from "@/components/app/nutrition-nav";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/feedback";
import { Field, NumberInput, Segmented, Select } from "@/components/ui/form";
import { toast } from "@/components/ui/overlay";
import { calculateAge } from "@/lib/calc/calories";
import { ACTIVITY_LEVELS, NUTRITION_GOALS } from "@/lib/constants";
import { displayToKg, kgToDisplay, round, titleCase, weightUnit } from "@/lib/client/format";
import { errorMessage, get, post, put } from "@/lib/client/api";
import { useUnits } from "@/lib/client/hooks";
import { grams, kcal } from "@/lib/client/nutrition";

type Profile = { dateOfBirth: string | null; sex: "MALE" | "FEMALE" | null; heightCm: number | null; activityLevel: string | null };
type Result = { bmr: number; tdee: number; targetCalories: number; macros: { proteinG: number; carbsG: number; fatG: number; fiberG: number }; warnings: string[]; settings: { adjustmentKcal: number } };

const ACTIVITY_COPY: Record<string, string> = { SEDENTARY: "Sedentary (desk job, little exercise)", LIGHT: "Light (1-3 sessions/week)", MODERATE: "Moderate (3-5 sessions/week)", VERY_ACTIVE: "Very active (6-7 sessions/week)", EXTREME: "Extreme (physical job + training)" };
const GOAL_COPY: Record<string, string> = { LOSE: "Lose fat", MAINTAIN: "Maintain weight", GAIN: "Build muscle" };

export function Calculator() {
  const units = useUnits();
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["me", "profile"], queryFn: () => get<Profile>("/me/profile") });
  const weight = useQuery({ queryKey: ["progress", "weights", "latest"], queryFn: () => get<{ latestKg: number | null }>("/progress/weights?range=all") });

  if (profile.isLoading || weight.isLoading) return <Skeleton className="h-96" />;
  return <Form key={`${profile.dataUpdatedAt}`} units={units} profile={profile.data} latestKg={weight.data?.latestKg ?? null} onSaved={() => qc.invalidateQueries({ queryKey: ["nutrition"] })} />;
}

function Form({ units, profile, latestKg, onSaved }: { units: "metric" | "imperial"; profile?: Profile; latestKg: number | null; onSaved: () => void }) {
  const [age, setAge] = useState<number | null>(profile?.dateOfBirth ? calculateAge(profile.dateOfBirth) : null);
  const [sex, setSex] = useState<"MALE" | "FEMALE">(profile?.sex ?? "MALE");
  const [height, setHeight] = useState<number | null>(profile?.heightCm ?? null);
  const [weightDisplay, setWeight] = useState<number | null>(latestKg ? round(kgToDisplay(latestKg, units), 1) : null);
  const [activity, setActivity] = useState(profile?.activityLevel ?? "MODERATE");
  const [goal, setGoal] = useState("LOSE");
  const [result, setResult] = useState<Result | null>(null);

  const body = (save: boolean) => ({ age, sex, heightCm: height, weightKg: weightDisplay === null ? null : Math.round(displayToKg(weightDisplay, units) * 10) / 10, activityLevel: activity, goal, save });
  const calc = useMutation({ mutationFn: () => post<Result>("/calories/calculate", body(false)), onSuccess: setResult, onError: (e) => toast.error(errorMessage(e)) });
  const save = useMutation({
    mutationFn: () => post<Result>("/calories/calculate", body(true)),
    onSuccess: (r) => { setResult(r); onSaved(); toast.success("Daily targets saved"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const valid = age && height && weightDisplay;

  return (
    <>
      <PageHeader title="Calorie calculator" subtitle="Mifflin-St Jeor estimate. A starting point, not medical advice." />
      <NutritionNav />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) calc.mutate(); }}>
            <Segmented label="Sex" value={sex} onChange={setSex} options={[{ value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }]} />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Age">{(p) => <NumberInput {...p} integer value={age} onValue={setAge} />}</Field>
              <Field label="Height (cm)">{(p) => <NumberInput {...p} value={height} onValue={setHeight} />}</Field>
              <Field label={`Weight (${weightUnit(units)})`}>{(p) => <NumberInput {...p} value={weightDisplay} onValue={setWeight} />}</Field>
            </div>
            <Field label="Activity level">{(p) => <Select {...p} value={activity} onChange={(e) => setActivity(e.target.value)}>{ACTIVITY_LEVELS.map((a) => <option key={a} value={a}>{ACTIVITY_COPY[a] ?? titleCase(a)}</option>)}</Select>}</Field>
            <Field label="Goal">{(p) => <Select {...p} value={goal} onChange={(e) => setGoal(e.target.value)}>{NUTRITION_GOALS.map((g) => <option key={g} value={g}>{GOAL_COPY[g]}</option>)}</Select>}</Field>
            <Button type="submit" size="lg" className="w-full" loading={calc.isPending} disabled={!valid}>Calculate</Button>
          </form>
        </Card>

        <Card className="p-5" aria-live="polite">
          {result ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-surface-2 py-3"><p className="display num text-3xl">{kcal(result.bmr)}</p><p className="text-[10px] uppercase tracking-wider text-subtle">BMR</p></div>
                <div className="rounded-xl bg-surface-2 py-3"><p className="display num text-3xl">{kcal(result.tdee)}</p><p className="text-[10px] uppercase tracking-wider text-subtle">Maintenance</p></div>
              </div>
              <div className="rounded-2xl bg-accent px-4 py-5 text-center text-accent-fg">
                <p className="text-xs font-bold uppercase tracking-widest">Daily target</p>
                <p className="display num text-6xl">{kcal(result.targetCalories)}</p>
                <p className="text-sm">kcal / day</p>
              </div>
              <dl className="grid grid-cols-4 gap-2 text-center">
                {([["Protein", result.macros.proteinG], ["Carbs", result.macros.carbsG], ["Fat", result.macros.fatG], ["Fiber", result.macros.fiberG]] as const).map(([l, v]) => (
                  <div key={l}><dt className="text-[10px] uppercase tracking-wider text-subtle">{l}</dt><dd className="display num text-2xl">{grams(v)}</dd></div>
                ))}
              </dl>
              {result.warnings.map((w) => <p key={w} role="alert" className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">{w}</p>)}
              <Button className="w-full" variant="secondary" loading={save.isPending} onClick={() => save.mutate()}>Use as my daily goal</Button>
            </div>
          ) : (
            <div className="flex h-full min-h-60 flex-col items-center justify-center text-center text-sm text-muted">
              <p className="display text-3xl text-fg">Your numbers</p>
              <p className="mt-1 max-w-xs">Fill in your details and calculate to see your BMR, maintenance and a daily target with macros.</p>
            </div>
          )}
        </Card>
      </div>
      <ManualGoal onSaved={onSaved} />
    </>
  );
}

function ManualGoal({ onSaved }: { onSaved: () => void }) {
  const goal = useQuery({ queryKey: ["nutrition", "goal"], queryFn: () => get<{ calorieTarget: number; proteinTargetG: number; carbsTargetG: number; fatTargetG: number; fiberTargetG: number | null } | null>("/nutrition/goal") });
  const [vals, setVals] = useState<{ cal: number | null; p: number | null; c: number | null; f: number | null } | null>(null);
  const cur = vals ?? (goal.data ? { cal: goal.data.calorieTarget, p: goal.data.proteinTargetG, c: goal.data.carbsTargetG, f: goal.data.fatTargetG } : { cal: null, p: null, c: null, f: null });
  const save = useMutation({
    mutationFn: () => put("/nutrition/goal", { calorieTarget: cur.cal, proteinTargetG: cur.p ?? 0, carbsTargetG: cur.c ?? 0, fatTargetG: cur.f ?? 0, source: "MANUAL" }),
    onSuccess: () => { onSaved(); goal.refetch(); toast.success("Goal updated"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Card as="section" className="mt-6 p-5">
      <h2 className="display text-2xl">Set targets manually</h2>
      <form className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label="Calories">{(p) => <NumberInput {...p} value={cur.cal} onValue={(v) => setVals({ ...cur, cal: v })} />}</Field>
        <Field label="Protein (g)">{(p) => <NumberInput {...p} value={cur.p} onValue={(v) => setVals({ ...cur, p: v })} />}</Field>
        <Field label="Carbs (g)">{(p) => <NumberInput {...p} value={cur.c} onValue={(v) => setVals({ ...cur, c: v })} />}</Field>
        <Field label="Fat (g)">{(p) => <NumberInput {...p} value={cur.f} onValue={(v) => setVals({ ...cur, f: v })} />}</Field>
        <div className="col-span-2 sm:col-span-4"><Button type="submit" variant="secondary" loading={save.isPending} disabled={!cur.cal}>Save targets</Button></div>
      </form>
    </Card>
  );
}
