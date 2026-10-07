/** Client formatting helpers. Weights are stored in kg; display honours the user's unit system. */

export type UnitSystem = "metric" | "imperial";
const KG_PER_LB = 0.45359237;

export const kgToDisplay = (kg: number, units: UnitSystem) => (units === "imperial" ? kg / KG_PER_LB : kg);
export const displayToKg = (v: number, units: UnitSystem) => (units === "imperial" ? v * KG_PER_LB : v);
export const weightUnit = (units: UnitSystem) => (units === "imperial" ? "lb" : "kg");

export function round(n: number, digits = 1) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function formatWeight(kg: number | null | undefined, units: UnitSystem, digits = 1) {
  if (kg === null || kg === undefined) return "–";
  return `${trim(round(kgToDisplay(kg, units), digits))} ${weightUnit(units)}`;
}

export function formatVolume(kg: number | null | undefined, units: UnitSystem) {
  if (kg === null || kg === undefined) return "–";
  const v = kgToDisplay(kg, units);
  return v >= 10_000 ? `${trim(round(v / 1000, 1))}k ${weightUnit(units)}` : `${Math.round(v).toLocaleString()} ${weightUnit(units)}`;
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds && seconds !== 0) return "–";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.max(0, Math.round(seconds))}s`;
}

/** mm:ss or h:mm:ss for timers. */
export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export const trim = (n: number) => String(n).replace(/\.0+$/, "");

export function timeAgo(iso: string | Date, now = Date.now()) {
  const t = typeof iso === "string" ? Date.parse(iso) : iso.getTime();
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  if (s < 7 * 86_400) return `${Math.round(s / 86_400)}d ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: new Date(t).getFullYear() === new Date(now).getFullYear() ? undefined : "numeric" });
}

export const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
export const longDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
export const timeOfDay = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export const titleCase = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const pluralize = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

/** Personal-record values arrive with a storage unit ("kg" | "reps" | "s" | "km"). */
export function formatRecordValue(value: number, unit: string, units: UnitSystem) {
  if (unit === "kg") return formatWeight(value, units);
  if (unit === "s") return formatDuration(value);
  return `${trim(round(value, 2))} ${unit}`;
}
