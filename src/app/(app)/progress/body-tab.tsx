"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { LineChart } from "@/components/charts/charts";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, ErrorState, SectionTitle, Skeleton, Stat } from "@/components/ui/feedback";
import { Field, NumberInput, Segmented, Select } from "@/components/ui/form";
import { toast } from "@/components/ui/overlay";
import { del, errorMessage, get, post } from "@/lib/client/api";
import { displayToKg, formatWeight, kgToDisplay, longDate, round, shortDate, titleCase, weightUnit } from "@/lib/client/format";
import { useUnits } from "@/lib/client/hooks";
import { MEASUREMENT_TYPES } from "@/lib/constants";

type Weights = { items: Array<{ id: string; weightKg: number; recordedAt: string }>; latestKg: number | null; changeKg: number | null };
type Measurement = { id: string; measurementType: string; valueCm: number; recordedAt: string };
const RANGES = [{ value: "30d", label: "30d" }, { value: "90d", label: "90d" }, { value: "365d", label: "1y" }, { value: "all", label: "All" }] as const;

export function BodyTab() {
  const units = useUnits();
  const qc = useQueryClient();
  const [range, setRange] = useState<(typeof RANGES)[number]["value"]>("90d");
  const [w, setW] = useState<number | null>(null);
  const [type, setType] = useState<string>("WAIST");
  const [m, setM] = useState<number | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["progress"] });

  const weights = useQuery({ queryKey: ["progress", "weights", range], queryFn: () => get<Weights>(`/progress/weights?range=${range}`) });
  const measures = useQuery({ queryKey: ["progress", "measurements", range, type], queryFn: () => get<Measurement[]>(`/progress/measurements?range=${range}&type=${type}`) });

  const addWeight = useMutation({
    mutationFn: () => post("/progress/weights", { weightKg: Math.round(displayToKg(w!, units) * 100) / 100 }),
    onSuccess: () => { setW(null); invalidate(); toast.success("Weight logged"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const addMeasure = useMutation({
    mutationFn: () => post("/progress/measurements", { measurementType: type, valueCm: m }),
    onSuccess: () => { setM(null); invalidate(); toast.success("Measurement logged"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const removeWeight = useMutation({ mutationFn: (id: string) => del(`/progress/weights/${id}`), onSuccess: invalidate, onError: (e) => toast.error(errorMessage(e)) });
  const removeMeasure = useMutation({ mutationFn: (id: string) => del(`/progress/measurements/${id}`), onSuccess: invalidate, onError: (e) => toast.error(errorMessage(e)) });

  return (
    <div className="space-y-8">
      <Segmented label="Time range" value={range} onChange={setRange} options={[...RANGES]} />

      <section aria-labelledby="weight-h">
        <SectionTitle><span id="weight-h">Body weight</span></SectionTitle>
        <Card className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Latest" value={formatWeight(weights.data?.latestKg, units)} />
            <Stat label={`Change (${range})`} value={weights.data?.changeKg == null ? "–" : `${weights.data.changeKg > 0 ? "+" : ""}${round(kgToDisplay(Math.abs(weights.data.changeKg), units) * Math.sign(weights.data.changeKg), 1)} ${weightUnit(units)}`} />
          </div>
          {weights.isLoading ? <Skeleton className="h-40" /> : weights.isError ? <ErrorState message={weights.error.message} onRetry={() => weights.refetch()} /> : <LineChart points={weights.data!.items.map((i) => ({ x: i.recordedAt, y: round(kgToDisplay(i.weightKg, units), 1) }))} unit={` ${weightUnit(units)}`} label="Body weight over time" formatX={shortDate} />}
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (w) addWeight.mutate(); }}>
            <Field label={`Log today's weight (${weightUnit(units)})`} className="flex-1">{(p) => <NumberInput {...p} value={w} onValue={setW} />}</Field>
            <Button type="submit" loading={addWeight.isPending} disabled={!w}>Log</Button>
          </form>
          {weights.data?.items.length ? (
            <ul className="divide-y divide-line text-sm">
              {[...weights.data.items].reverse().slice(0, 8).map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2">
                  <span className="text-muted">{longDate(i.recordedAt)}</span>
                  <span className="num font-semibold">{formatWeight(i.weightKg, units)}</span>
                  <button type="button" aria-label="Delete entry" onClick={() => removeWeight.mutate(i.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-danger-soft hover:text-danger"><Trash2 className="h-4 w-4" aria-hidden /></button>
                </li>
              ))}
            </ul>
          ) : weights.data ? <EmptyState title="No weigh-ins yet" description="Log your weight to see the trend." /> : null}
        </Card>
      </section>

      <section aria-labelledby="meas-h">
        <SectionTitle><span id="meas-h">Measurements</span></SectionTitle>
        <Card className="space-y-5 p-5">
          <Field label="Body part">{(p) => <Select {...p} value={type} onChange={(e) => setType(e.target.value)}>{MEASUREMENT_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select>}</Field>
          {measures.isLoading ? <Skeleton className="h-40" /> : <LineChart points={(measures.data ?? []).map((i) => ({ x: i.recordedAt, y: i.valueCm }))} unit=" cm" label={`${titleCase(type)} measurement over time`} formatX={shortDate} />}
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (m) addMeasure.mutate(); }}>
            <Field label="Value (cm)" className="flex-1">{(p) => <NumberInput {...p} value={m} onValue={setM} />}</Field>
            <Button type="submit" loading={addMeasure.isPending} disabled={!m}>Log</Button>
          </form>
          {measures.data?.length ? (
            <ul className="divide-y divide-line text-sm">
              {[...measures.data].reverse().slice(0, 6).map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2">
                  <span className="text-muted">{longDate(i.recordedAt)}</span>
                  <span className="num font-semibold">{i.valueCm} cm</span>
                  <button type="button" aria-label="Delete entry" onClick={() => removeMeasure.mutate(i.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle hover:bg-danger-soft hover:text-danger"><Trash2 className="h-4 w-4" aria-hidden /></button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
