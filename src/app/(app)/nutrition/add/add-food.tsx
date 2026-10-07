"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { NutritionNav } from "@/components/app/nutrition-nav";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Field, Input, NumberInput, Segmented, Select } from "@/components/ui/form";
import { toast } from "@/components/ui/overlay";
import { errorMessage, get, post, qs } from "@/lib/client/api";
import { scaleFood, compatibleUnits } from "@/lib/calc/nutrition";
import { todayLocal } from "@/lib/client/format";
import { consumedAtFor, defaultMeal, grams, kcal, MEALS, type Food } from "@/lib/client/nutrition";
import { FOOD_UNITS } from "@/lib/constants";

export function AddFood() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const today = todayLocal();
  const date = params.get("date") ?? today;
  const [meal, setMeal] = useState<string>(params.get("meal") ?? defaultMeal());
  const [mode, setMode] = useState<"search" | "manual">("search");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<Food | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const results = useQuery({ queryKey: ["foods", debounced], queryFn: ({ signal }) => get<Food[]>(`/foods${qs({ q: debounced, limit: 25 })}`, signal), enabled: debounced.length > 0 });
  const recent = useQuery({ queryKey: ["foods", "recent"], queryFn: () => get<Food[]>("/foods/recent"), enabled: debounced.length === 0 });

  const add = useMutation({
    mutationFn: (body: Record<string, unknown>) => post("/nutrition/entries", { mealName: meal, consumedAt: consumedAtFor(date, today), ...body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition"] });
      qc.invalidateQueries({ queryKey: ["foods", "recent"] });
      toast.success("Added");
      router.push(date === today ? "/nutrition" : `/nutrition?date=${date}`);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const list = debounced ? results.data : recent.data;
  const loading = debounced ? results.isLoading : recent.isLoading;

  return (
    <>
      <PageHeader title="Add food" subtitle={date === today ? undefined : `For ${date}`} />
      <NutritionNav />
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Segmented label="Entry type" value={mode} onChange={(v) => { setMode(v); setPicked(null); }} options={[{ value: "search", label: "Search" }, { value: "manual", label: "Manual" }]} />
        <Select aria-label="Meal" value={meal} onChange={(e) => setMeal(e.target.value)}>
          {MEALS.map((m) => <option key={m}>{m}</option>)}
        </Select>
      </div>

      {mode === "manual" ? (
        <ManualForm loading={add.isPending} onSubmit={(v) => add.mutate({ ...v, source: "MANUAL" })} />
      ) : picked ? (
        <PortionForm food={picked} loading={add.isPending} onBack={() => setPicked(null)} onSubmit={(v) => add.mutate({ foodItemId: picked.id, foodName: picked.name, source: "SEARCH", ...v })} />
      ) : (
        <>
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
            <Input aria-label="Search foods" placeholder="Search foods, e.g. chicken breast" className="h-12 pl-10" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          {!debounced ? <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Recent</p> : null}
          {loading ? <Skeleton className="h-48" /> : null}
          {list && list.length === 0 ? (
            <EmptyState title={debounced ? `No match for “${debounced}”` : "No recent foods"} description={debounced ? "Try a simpler term, or enter the macros manually." : "Foods you log will appear here for one-tap re-adding."} action={debounced ? <Button variant="outline" onClick={() => setMode("manual")}>Enter manually</Button> : undefined} />
          ) : null}
          {list?.length ? (
            <Card className="divide-y divide-line">
              {list.map((f) => (
                <button key={f.id} type="button" onClick={() => setPicked(f)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{f.name}{f.brand ? <span className="text-subtle"> · {f.brand}</span> : null}</span>
                    <span className="num block text-xs text-subtle">per {f.servingSize} {f.servingUnit} · P {Math.round(f.proteinG)} · C {Math.round(f.carbsG)} · F {Math.round(f.fatG)}</span>
                  </span>
                  <span className="num text-sm font-semibold">{kcal(f.calories)}</span>
                </button>
              ))}
            </Card>
          ) : null}
          <p className="mt-4 text-center text-sm text-muted">
            Prefer a photo? <Link href="/nutrition/scan" className="font-semibold text-accent hover:underline">Scan your meal</Link>
          </p>
        </>
      )}
    </>
  );
}

function PortionForm({ food, loading, onBack, onSubmit }: { food: Food; loading: boolean; onBack: () => void; onSubmit: (v: { quantity: number; unit: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number }) => void }) {
  const [quantity, setQuantity] = useState<number | null>(food.servingSize);
  const [unit, setUnit] = useState(food.servingUnit);
  const units = compatibleUnits(food.servingUnit);
  const macros = quantity ? scaleFood(food, quantity, unit) : null;

  return (
    <Card className="space-y-5 p-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="h-4 w-4" aria-hidden /> Back to results</button>
      <div>
        <h2 className="display text-3xl">{food.name}</h2>
        <p className="text-xs text-subtle">{food.brand ? `${food.brand} · ` : ""}per {food.servingSize} {food.servingUnit}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">{(p) => <NumberInput {...p} value={quantity} onValue={setQuantity} autoFocus />}</Field>
        <Field label="Unit">{(p) => <Select {...p} value={unit} onChange={(e) => setUnit(e.target.value)}>{units.map((u) => <option key={u}>{u}</option>)}</Select>}</Field>
      </div>
      <dl className="grid grid-cols-4 gap-2 rounded-xl bg-surface-2 p-3 text-center" aria-live="polite">
        {([["kcal", macros ? kcal(macros.calories) : "–"], ["Protein", macros ? grams(macros.proteinG) : "–"], ["Carbs", macros ? grams(macros.carbsG) : "–"], ["Fat", macros ? grams(macros.fatG) : "–"]] as const).map(([l, v]) => (
          <div key={l}><dt className="text-[10px] uppercase tracking-wider text-subtle">{l}</dt><dd className="display num text-2xl">{v}</dd></div>
        ))}
      </dl>
      <Button size="lg" className="w-full" loading={loading} disabled={!macros || !quantity} onClick={() => macros && quantity && onSubmit({ quantity, unit, ...macros })}>Add to diary</Button>
    </Card>
  );
}

function ManualForm({ loading, onSubmit }: { loading: boolean; onSubmit: (v: { foodName: string; quantity: number; unit: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number | null }) => void }) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState<number | null>(1);
  const [unit, setUnit] = useState("serving");
  const [calories, setCalories] = useState<number | null>(null);
  const [protein, setProtein] = useState<number | null>(null);
  const [carbs, setCarbs] = useState<number | null>(null);
  const [fat, setFat] = useState<number | null>(null);
  const [fiber, setFiber] = useState<number | null>(null);
  const valid = name.trim() && quantity && calories !== null;

  return (
    <Card className="p-5">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit({ foodName: name.trim(), quantity: quantity!, unit, calories: calories!, proteinG: protein ?? 0, carbsG: carbs ?? 0, fatG: fat ?? 0, fiberG: fiber }); }}>
        <Field label="Food name">{(p) => <Input {...p} required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">{(p) => <NumberInput {...p} value={quantity} onValue={setQuantity} />}</Field>
          <Field label="Unit">{(p) => <Select {...p} value={unit} onChange={(e) => setUnit(e.target.value)}>{FOOD_UNITS.map((u) => <option key={u}>{u}</option>)}</Select>}</Field>
        </div>
        <p className="text-xs text-subtle">Enter the totals for the amount you ate.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calories (kcal)">{(p) => <NumberInput {...p} value={calories} onValue={setCalories} />}</Field>
          <Field label="Protein (g)" optional>{(p) => <NumberInput {...p} value={protein} onValue={setProtein} />}</Field>
          <Field label="Carbs (g)" optional>{(p) => <NumberInput {...p} value={carbs} onValue={setCarbs} />}</Field>
          <Field label="Fat (g)" optional>{(p) => <NumberInput {...p} value={fat} onValue={setFat} />}</Field>
          <Field label="Fiber (g)" optional>{(p) => <NumberInput {...p} value={fiber} onValue={setFiber} />}</Field>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={loading} disabled={!valid}>Add to diary</Button>
      </form>
    </Card>
  );
}
