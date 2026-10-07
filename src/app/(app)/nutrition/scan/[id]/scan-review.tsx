"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NutritionNav } from "@/components/app/nutrition-nav";
import { PageHeader } from "@/components/app/page-header";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Card, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, Input, NumberInput, Select } from "@/components/ui/form";
import { ConfirmDialog, Dialog, toast } from "@/components/ui/overlay";
import { del, errorMessage, get, patch, post } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { defaultMeal, grams, kcal, MEALS } from "@/lib/client/nutrition";
import type { FoodScan } from "@/lib/client/types";
import { FOOD_UNITS } from "@/lib/constants";

type Item = FoodScan["items"][number];

const FAIL_COPY: Record<string, string> = {
  NO_FOOD_DETECTED: "We couldn't spot any food in that photo. Try a closer, brighter shot of the plate.",
  AI_UNAVAILABLE: "The analysis service is unavailable right now. Retry in a moment, or log the meal manually.",
  TIMEOUT: "The analysis took too long. You can retry it.",
};

const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n * 100)}%`);

export function ScanReview({ id }: { id: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [meal, setMeal] = useState<string>(defaultMeal());
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const scan = useQuery({
    queryKey: ["scan", id],
    queryFn: () => get<FoodScan>(`/food-scans/${id}`),
    // Poll only while the AI is working.
    refetchInterval: (q) => (q.state.data?.status === "PROCESSING" ? 1500 : false),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["scan", id] });

  const retry = useMutation({ mutationFn: () => post(`/food-scans/${id}/retry`), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });
  const cancel = useMutation({ mutationFn: () => del(`/food-scans/${id}`), onSuccess: () => router.replace("/nutrition/scan"), onError: (e) => toast.error(errorMessage(e)) });
  const removeItem = useMutation({ mutationFn: (itemId: string) => del(`/food-scans/${id}/items/${itemId}`), onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) });
  const confirm = useMutation({
    mutationFn: () => post(`/food-scans/${id}/confirm`, { mealName: meal }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition"] });
      qc.invalidateQueries({ queryKey: ["scans"] });
      refresh();
      toast.success("Meal logged");
      router.push("/nutrition");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (scan.isLoading) return <Skeleton className="h-96" />;
  if (scan.isError) return <ErrorState message={scan.error.message} onRetry={() => scan.refetch()} />;
  const s = scan.data!;
  const totals = s.items.reduce((t, i) => ({ calories: t.calories + (i.calories ?? 0), proteinG: t.proteinG + (i.proteinG ?? 0), carbsG: t.carbsG + (i.carbsG ?? 0), fatG: t.fatG + (i.fatG ?? 0) }), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  const needsReview = s.items.filter((i) => i.needsReview).length;
  const incomplete = s.items.some((i) => i.calories === null);

  return (
    <>
      <PageHeader title="Review scan" />
      <NutritionNav />

      {s.imageUrl ? (
        <div className="mb-5 overflow-hidden rounded-2xl bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element -- authorised media route */}
          <img src={s.imageUrl} alt="Your meal" className={cn("mx-auto max-h-72 w-full object-contain", s.status === "PROCESSING" && "animate-pulse opacity-70")} />
        </div>
      ) : null}

      {s.status === "PROCESSING" ? (
        <Card className="space-y-3 p-6 text-center" aria-live="polite">
          <p className="display text-3xl">Analysing your plate…</p>
          <p className="text-sm text-muted">Identifying foods and estimating portions. This takes a few seconds.</p>
          <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full bg-surface-3"><div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-accent" /></div>
          <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)}>Cancel</Button>
        </Card>
      ) : null}

      {s.status === "FAILED" || s.status === "CANCELLED" ? (
        <Card className="space-y-4 p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-warning" aria-hidden />
          <p className="font-semibold">{s.status === "CANCELLED" ? "This scan was cancelled." : FAIL_COPY[s.errorCode ?? ""] ?? "The analysis didn't work out."}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {s.status === "FAILED" && s.errorCode !== "NO_FOOD_DETECTED" ? <Button loading={retry.isPending} onClick={() => retry.mutate()}><RefreshCw className="h-4 w-4" aria-hidden /> Retry</Button> : null}
            <ButtonLink variant="secondary" href="/nutrition/scan">New photo</ButtonLink>
            <ButtonLink variant="outline" href="/nutrition/add">Add manually</ButtonLink>
          </div>
        </Card>
      ) : null}

      {s.status === "CONFIRMED" ? (
        <Card className="space-y-3 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden />
          <p className="font-semibold">This meal is already in your diary.</p>
          <ButtonLink href="/nutrition">Go to today</ButtonLink>
        </Card>
      ) : null}

      {s.status === "COMPLETED" ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted" role="note">
            These are AI estimates. {needsReview > 0 ? <strong className="text-warning">{needsReview} item{needsReview > 1 ? "s" : ""} flagged. Please double-check.</strong> : "Adjust anything that looks off before logging."}
          </div>

          <ul className="space-y-3" aria-label="Detected foods">
            {s.items.map((i) => (
              <li key={i.id}>
                <Card className={cn("p-4", i.needsReview && "border-warning/50")}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{i.recognizedName}</p>
                      <p className="num text-sm text-muted">{i.estimatedQuantity} {i.estimatedUnit}</p>
                    </div>
                    <div className="text-right">
                      <p className="display num text-2xl">{i.calories === null ? "?" : kcal(i.calories)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-subtle">kcal</p>
                    </div>
                  </div>
                  {i.calories === null ? (
                    <p className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">We couldn&apos;t find nutrition data for this one. Edit it to enter the values.</p>
                  ) : (
                    <p className="num mt-1 text-xs text-subtle">P {grams(i.proteinG ?? 0)} · C {grams(i.carbsG ?? 0)} · F {grams(i.fatG ?? 0)}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone={i.needsReview ? "warning" : "success"} className="cursor-help" >
                      <span title={`Vision ${pct(i.confidence.vision)} · Food match ${pct(i.confidence.foodMatch)} · Portion ${pct(i.confidence.portion)}`}>
                        {i.needsReview ? "Check this" : "Confident"} · {pct(i.confidence.overall)}
                      </span>
                    </Badge>
                    {i.source === "USER" ? <Badge>Edited</Badge> : null}
                    <div className="ml-auto flex gap-1">
                      <button type="button" aria-label={`Edit ${i.recognizedName}`} onClick={() => setEditing(i)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"><Pencil className="h-4 w-4" aria-hidden /></button>
                      <button type="button" aria-label={`Remove ${i.recognizedName}`} onClick={() => removeItem.mutate(i.id)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="h-4 w-4" aria-hidden /></button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>

          <Button variant="outline" className="w-full border-dashed" onClick={() => setEditing("new")}><Plus className="h-4 w-4" aria-hidden /> Add a missing food</Button>

          <Card className="space-y-4 p-5">
            <dl className="grid grid-cols-4 gap-2 text-center">
              {([["kcal", kcal(totals.calories)], ["Protein", grams(totals.proteinG)], ["Carbs", grams(totals.carbsG)], ["Fat", grams(totals.fatG)]] as const).map(([l, v]) => (
                <div key={l}><dt className="text-[10px] uppercase tracking-wider text-subtle">{l}</dt><dd className="display num text-2xl">{v}</dd></div>
              ))}
            </dl>
            <Field label="Log as">{(p) => <Select {...p} value={meal} onChange={(e) => setMeal(e.target.value)}>{MEALS.map((m) => <option key={m}>{m}</option>)}</Select>}</Field>
            {incomplete ? <p className="text-xs text-warning">Foods without calories will be logged as 0 kcal. Edit them first for accuracy.</p> : null}
            <Button size="lg" className="w-full" loading={confirm.isPending} disabled={s.items.length === 0} onClick={() => confirm.mutate()}>Confirm &amp; log meal</Button>
            <p className="text-center text-xs text-subtle"><Link href="/nutrition/scan" className="hover:underline">Discard and take a new photo</Link></p>
          </Card>
        </div>
      ) : null}

      <ItemDialog scanId={id} item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      <ConfirmDialog open={confirmCancel} onClose={() => setConfirmCancel(false)} onConfirm={() => cancel.mutate()} loading={cancel.isPending} title="Cancel this scan?" confirmLabel="Cancel scan" danger message="The photo and analysis are discarded." />
    </>
  );
}

function ItemDialog({ scanId, item, onClose, onSaved }: { scanId: string; item: Item | "new" | null; onClose: () => void; onSaved: () => void }) {
  const existing = item && item !== "new" ? item : null;
  return (
    <Dialog open={item !== null} onClose={onClose} title={existing ? "Edit food" : "Add food"}>
      {item ? <ItemForm key={existing?.id ?? "new"} scanId={scanId} existing={existing} onClose={onClose} onSaved={onSaved} /> : null}
    </Dialog>
  );
}

function ItemForm({ scanId, existing, onClose, onSaved }: { scanId: string; existing: Item | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(existing?.recognizedName ?? "");
  const [quantity, setQuantity] = useState<number | null>(existing?.estimatedQuantity ?? 100);
  const [unit, setUnit] = useState(existing?.estimatedUnit ?? "g");
  const [calories, setCalories] = useState<number | null>(existing?.calories ?? null);
  const [protein, setProtein] = useState<number | null>(existing?.proteinG ?? null);
  const [carbs, setCarbs] = useState<number | null>(existing?.carbsG ?? null);
  const [fat, setFat] = useState<number | null>(existing?.fatG ?? null);
  const save = useMutation({
    mutationFn: () => {
      const body = { recognizedName: name.trim(), estimatedQuantity: quantity, estimatedUnit: unit, calories: calories ?? 0, proteinG: protein ?? 0, carbsG: carbs ?? 0, fatG: fat ?? 0 };
      return existing ? patch(`/food-scans/${scanId}/items/${existing.id}`, body) : post(`/food-scans/${scanId}/items`, body);
    },
    onSuccess: onSaved,
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <Field label="Food">{(p) => <Input {...p} required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount">{(p) => <NumberInput {...p} value={quantity} onValue={setQuantity} />}</Field>
        <Field label="Unit">{(p) => <Select {...p} value={unit} onChange={(e) => setUnit(e.target.value)}>{FOOD_UNITS.map((u) => <option key={u}>{u}</option>)}</Select>}</Field>
      </div>
      <p className="text-xs text-subtle">Nutrition totals for this amount:</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Calories">{(p) => <NumberInput {...p} value={calories} onValue={setCalories} />}</Field>
        <Field label="Protein (g)">{(p) => <NumberInput {...p} value={protein} onValue={setProtein} />}</Field>
        <Field label="Carbs (g)">{(p) => <NumberInput {...p} value={carbs} onValue={setCarbs} />}</Field>
        <Field label="Fat (g)">{(p) => <NumberInput {...p} value={fat} onValue={setFat} />}</Field>
      </div>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={save.isPending} disabled={!name.trim() || !quantity}>Save</Button></div>
    </form>
  );
}
