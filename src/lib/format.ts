import { formatDistanceToNowStrict } from "date-fns";

export type UnitSystem = "metric" | "imperial";

const KG_PER_LB = 0.45359237;
const KM_PER_MI = 1.609344;
const CM_PER_IN = 2.54;

const round = (n: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/** Weights are stored in kg; convert to the user's display system. */
export const kgToDisplay = (kg: number, units: UnitSystem) => (units === "imperial" ? kg / KG_PER_LB : kg);
export const displayToKg = (v: number, units: UnitSystem) => (units === "imperial" ? v * KG_PER_LB : v);
export const kmToDisplay = (km: number, units: UnitSystem) => (units === "imperial" ? km / KM_PER_MI : km);
export const displayToKm = (v: number, units: UnitSystem) => (units === "imperial" ? v * KM_PER_MI : v);
export const cmToDisplay = (cm: number, units: UnitSystem) => (units === "imperial" ? cm / CM_PER_IN : cm);
export const displayToCm = (v: number, units: UnitSystem) => (units === "imperial" ? v * CM_PER_IN : v);

export const weightUnitLabel = (units: UnitSystem) => (units === "imperial" ? "lb" : "kg");
export const distanceUnitLabel = (units: UnitSystem) => (units === "imperial" ? "mi" : "km");
export const lengthUnitLabel = (units: UnitSystem) => (units === "imperial" ? "in" : "cm");

export function formatWeight(kg: number | null | undefined, units: UnitSystem = "metric", digits = 1): string {
  if (kg === null || kg === undefined) return "—";
  return `${String(round(kgToDisplay(kg, units), digits))} ${weightUnitLabel(units)}`;
}

export function formatDistance(km: number | null | undefined, units: UnitSystem = "metric"): string {
  if (km === null || km === undefined) return "—";
  return `${String(round(kmToDisplay(km, units), 2))} ${distanceUnitLabel(units)}`;
}

export function formatVolume(kg: number | null | undefined, units: UnitSystem = "metric"): string {
  if (kg === null || kg === undefined) return "—";
  return `${Math.round(kgToDisplay(kg, units)).toLocaleString("en-US")} ${weightUnitLabel(units)}`;
}

/** 3840 → "1h 04m", 95 → "1m 35s". */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined) return "—";
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return sec ? `${m}m ${String(sec).padStart(2, "0")}s` : `${m}m`;
  return `${sec}s`;
}

/** 83 → "01:23" / 3723 → "1:02:03" (timers). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined) return "—";
  return round(n, digits).toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Date.now() - d.getTime() < 45_000) return "just now";
  return `${formatDistanceToNowStrict(d)} ago`;
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
