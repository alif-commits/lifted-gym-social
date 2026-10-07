"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ChevronLeft, ChevronRight, Plus, Share2, Target, Trash2, Utensils } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { NutritionNav } from "@/components/app/nutrition-nav";
import { PageHeader } from "@/components/app/page-header";
import { Ring } from "@/components/charts/charts";
import { Button, ButtonLink, IconButton } from "@/components/ui/button";
import { Card, EmptyState, ErrorState, ProgressBar, SectionTitle, Skeleton } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog, toast } from "@/components/ui/overlay";
import { Field, NumberInput, Select } from "@/components/ui/form";
import { del, errorMessage, get, patch, post, qs } from "@/lib/client/api";
import { addDays, longDate, todayLocal } from "@/lib/client/format";
import { grams, kcal, type DayData, type DayEntry } from "@/lib/client/nutrition";
import { FOOD_UNITS } from "@/lib/constants";
import { cn } from "@/lib/client/cn";

export function NutritionDashboard() {
  const router = useRouter();
  const qc = useQueryClient();
  const today = todayLocal();
  const date = useSearchParams().get("date") ?? today;
  const [editing, setEditing] = useState<DayEntry | null>(null);
  const [toDelete, setToDelete] = useState<DayEntry | null>(null);
  const [sharing, setSharing] = useState(false);

  const q = useQuery({ queryKey: ["nutrition", "day", date], queryFn: () => get<DayData>(`/nutrition/day${qs({ date })}`) });
  const go = (d: string) => router.replace(d === today ? "/nutrition" : `/nutrition?date=${d}`);
  const refresh = () => qc.invalidateQueries({ queryKey: ["nutrition"] });
  const remove = useMutation({ mutationFn: (id: string) => del(`/nutrition/entries/${id}`), onSuccess: () => { refresh(); setToDelete(null); }, onError: (e) => toast.error(errorMessage(e)) });

  const d = q.data;
  const hasEntries = !!d?.meals.length;

  return (
    <>
      <PageHeader
        title="Nutrition"
        actions={
          <>
            <ButtonLink href={`/nutrition/scan`} variant="secondary"><Camera className="h-4 w-4" aria-hidden /> Scan</ButtonLink>
            <ButtonLink href={`/nutrition/add?date=${date}`}><Plus className="h-4 w-4" aria-hidden /> Add food</ButtonLink>
          </>
        }
      />
      <NutritionNav />

      <div className="mb-5 flex items-center justify-between">
        <IconButton label="Previous day" onClick={() => go(addDays(date, -1))}><ChevronLeft className="h-5 w-5" aria-hidden /></IconButton>
        <div className="text-center">
          <p className="font-semibold" aria-live="polite">{date === today ? "Today" : longDate(`${date}T12:00:00`)}</p>
          {date !== today ? <button type="button" onClick={() => go(today)} className="text-xs text-accent hover:underline">Back to today</button> : null}
        </div>
        <IconButton label="Next day" disabled={date >= today} onClick={() => go(addDays(date, 1))}><ChevronRight className="h-5 w-5" aria-hidden /></IconButton>
      </div>

      {q.isLoading ? <Skeleton className="h-64" /> : null}
      {q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : null}

      {d ? (
        <>
          <Card as="section" className="mb-6 p-5" aria-label="Daily summary">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <Ring value={d.totals.calories} max={d.goal?.calorieTarget ?? Math.max(d.totals.calories, 1)} label="Calories" size={160} stroke={14}>
                <span className="display num text-4xl">{kcal(d.totals.calories)}</span>
                <span className="text-xs text-subtle">{d.goal ? `of ${kcal(d.goal.calorieTarget)} kcal` : "kcal"}</span>
                {d.progress.calories.remaining !== null ? (
                  <span className={cn("mt-0.5 text-xs font-semibold", d.progress.calories.remaining < 0 ? "text-danger" : "text-accent")}>
                    {d.progress.calories.remaining < 0 ? `${kcal(-d.progress.calories.remaining)} over` : `${kcal(d.progress.calories.remaining)} left`}
                  </span>
                ) : null}
              </Ring>
              <div className="w-full flex-1 space-y-3">
                {([
                  ["Protein", "proteinG", "protein"],
                  ["Carbs", "carbsG", "carbs"],
                  ["Fat", "fatG", "fat"],
                ] as const).map(([label, key, tone]) => (
                  <div key={key}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">{label}</span>
                      <span className="num text-muted">{grams(d.totals[key])}{d.progress[key].target ? ` / ${grams(d.progress[key].target!)}` : ""}</span>
                    </div>
                    <ProgressBar value={d.totals[key]} max={d.progress[key].target ?? Math.max(d.totals[key], 1)} tone={tone} label={`${label} progress`} />
                  </div>
                ))}
                <p className="num text-xs text-subtle">Fiber {grams(d.totals.fiberG)}{d.progress.fiberG.target ? ` / ${grams(d.progress.fiberG.target)}` : ""}</p>
              </div>
            </div>
            {!d.goal ? (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-sm">
                <span className="flex items-center gap-2"><Target className="h-4 w-4 text-accent" aria-hidden /> Set a daily target to see progress.</span>
                <ButtonLink size="sm" href="/nutrition/calculator">Calculate my goal</ButtonLink>
              </div>
            ) : null}
          </Card>

          {hasEntries ? (
            <div className="space-y-5">
              {d.meals.map((m) => (
                <section key={m.name} aria-label={m.name}>
                  <SectionTitle action={<Link href={`/nutrition/add?meal=${encodeURIComponent(m.name)}&date=${date}`} className="text-sm font-semibold text-accent hover:underline">Add</Link>}>
                    {m.name} <span className="num ml-2 text-base text-subtle">{kcal(m.totals.calories)} kcal</span>
                  </SectionTitle>
                  <Card className="divide-y divide-line">
                    {m.items.map((e) => (
                      <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                        <button type="button" onClick={() => setEditing(e)} className="min-w-0 flex-1 text-left" aria-label={`Edit ${e.foodName}`}>
                          <p className="truncate font-medium">{e.foodName}</p>
                          <p className="num text-xs text-subtle">{e.quantity} {e.unit} · P {Math.round(e.proteinG)} · C {Math.round(e.carbsG)} · F {Math.round(e.fatG)}</p>
                        </button>
                        <span className="num text-sm font-semibold">{kcal(e.calories)}</span>
                        <button type="button" aria-label={`Delete ${e.foodName}`} onClick={() => setToDelete(e)} className="flex h-9 w-9 items-center justify-center rounded-lg text-subtle hover:bg-danger-soft hover:text-danger"><Trash2 className="h-4 w-4" aria-hidden /></button>
                      </div>
                    ))}
                  </Card>
                </section>
              ))}
              <Button variant="outline" onClick={() => setSharing(true)}><Share2 className="h-4 w-4" aria-hidden /> Share this day</Button>
            </div>
          ) : (
            <EmptyState icon={<Utensils className="h-7 w-7" aria-hidden />} title="Nothing logged yet" description="Search for a food, enter macros by hand, or snap a photo of your plate." action={<div className="flex flex-wrap justify-center gap-2"><ButtonLink href={`/nutrition/add?date=${date}`}>Add food</ButtonLink><ButtonLink href="/nutrition/scan" variant="outline">Scan a meal</ButtonLink></div>} />
          )}
        </>
      ) : null}

      <ConfirmDialog open={toDelete !== null} onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete.id)} loading={remove.isPending} danger title="Remove entry?" confirmLabel="Remove" message={`“${toDelete?.foodName}” will be removed from this day.`} />
      <EditEntry entry={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      <ShareDay date={date} open={sharing} onClose={() => setSharing(false)} />
    </>
  );
}

function EditEntry({ entry, onClose, onSaved }: { entry: DayEntry | null; onClose: () => void; onSaved: () => void }) {
  const [qty, setQty] = useState<number | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [meal, setMeal] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => {
      if (!entry) return Promise.resolve();
      // Library-backed entries rescale on the server; manual ones keep their macros.
      return patch(`/nutrition/entries/${entry.id}`, { quantity: qty ?? entry.quantity, unit: unit ?? entry.unit, ...(meal ? { mealName: meal } : {}) });
    },
    onSuccess: () => { setQty(null); setUnit(null); setMeal(null); onSaved(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={entry !== null} onClose={onClose} title="Edit entry">
      {entry ? (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <p className="font-semibold">{entry.foodName}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity">{(p) => <NumberInput {...p} value={qty ?? entry.quantity} onValue={(v) => setQty(v)} />}</Field>
            <Field label="Unit">{(p) => <Select {...p} value={unit ?? entry.unit} onChange={(e) => setUnit(e.target.value)}>{FOOD_UNITS.map((u) => <option key={u}>{u}</option>)}</Select>}</Field>
          </div>
          <Field label="Meal">{(p) => <Select {...p} value={meal ?? entry.mealName} onChange={(e) => setMeal(e.target.value)}>{["Breakfast", "Lunch", "Dinner", "Snack", "Pre-Workout", "Post-Workout", "Other"].map((m) => <option key={m}>{m}</option>)}</Select>}</Field>
          {!entry.foodItemId ? <p className="text-xs text-subtle">Manual entries keep their entered macros when you change the quantity.</p> : null}
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={save.isPending}>Save</Button></div>
        </form>
      ) : null}
    </Dialog>
  );
}

const METRICS = [["calories", "Calories"], ["proteinG", "Protein"], ["carbsG", "Carbs"], ["fatG", "Fat"], ["fiberG", "Fiber"]] as const;

function ShareDay({ date, open, onClose }: { date: string; open: boolean; onClose: () => void }) {
  const [picked, setPicked] = useState<string[]>(["calories", "proteinG", "carbsG", "fatG"]);
  const [url, setUrl] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => post<{ id: string; url: string }>("/nutrition/share-cards", { date, metrics: picked }),
    onSuccess: (r) => setUrl(`${location.origin}${r.url}`),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={open} onClose={() => { setUrl(null); onClose(); }} title="Share nutrition day">
      {url ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">Anyone with this link sees only the totals you picked. Food names and notes are never included.</p>
          <input readOnly aria-label="Share link" value={url} onFocus={(e) => e.currentTarget.select()} className="h-11 w-full rounded-xl border border-line-strong bg-surface-2 px-3 text-sm" />
          <Button onClick={async () => { await navigator.clipboard.writeText(url).catch(() => null); toast.success("Link copied"); }}>Copy link</Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Metrics to show</legend>
            <div className="space-y-2">
              {METRICS.map(([k, l]) => (
                <label key={k} className="flex min-h-11 items-center gap-3 rounded-xl bg-surface-2 px-4">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={picked.includes(k)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, k] : p.filter((x) => x !== k)))} />
                  {l}
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit" loading={create.isPending} disabled={picked.length === 0}>Create link</Button>
        </form>
      )}
    </Dialog>
  );
}
