/**
 * Timezone helpers (no dependencies). All timestamps are stored in UTC; "days" for nutrition
 * and streaks are computed in the user's IANA timezone.
 */

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function offsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - (date.getTime() - date.getUTCMilliseconds());
}

/** Convert a wall-clock time in `tz` to the matching UTC instant. */
export function zonedTimeToUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
  ss: number,
  tz: string,
): Date {
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss);
  const first = offsetMs(new Date(guess), tz);
  let utc = guess - first;
  const second = offsetMs(new Date(utc), tz);
  if (second !== first) utc = guess - second;
  return new Date(utc);
}

/** `YYYY-MM-DD` for an instant as seen in `tz`. */
export function toLocalDate(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDaysToDateString(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** UTC `[start, end)` instants covering the local calendar day `day` (YYYY-MM-DD) in `tz`. */
export function localDayRange(day: string, tz: string): { start: Date; end: Date } {
  const [y, m, d] = day.split("-").map(Number);
  const start = zonedTimeToUtc(y, m, d, 0, 0, 0, tz);
  const [ny, nm, nd] = addDaysToDateString(day, 1).split("-").map(Number);
  const end = zonedTimeToUtc(ny, nm, nd, 0, 0, 0, tz);
  return { start, end };
}

export function isDateString(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  // Round-trip: V8 happily rolls "2026-02-30" over to March 2, which must not count as valid.
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v;
}
