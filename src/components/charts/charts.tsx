"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/client/cn";

/* Small dependency-free SVG charts. All are responsive (viewBox) and expose a text summary for screen readers. */

type Point = { x: string; y: number };

const W = 600;
const H = 220;
const PAD = { l: 40, r: 12, t: 12, b: 26 };

function niceBounds(min: number, max: number) {
  if (min === max) return { min: min - 1, max: max + 1 };
  const pad = (max - min) * 0.12;
  return { min: Math.max(0, min - pad), max: max + pad };
}

export function LineChart({ points, unit = "", color = "var(--accent)", label, className, formatX }: { points: Point[]; unit?: string; color?: string; label: string; className?: string; formatX?: (x: string) => string }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return <ChartEmpty className={className} />;
  const ys = points.map((p) => p.y);
  const { min, max } = niceBounds(Math.min(...ys), Math.max(...ys));
  const sx = (i: number) => PAD.l + (points.length === 1 ? (W - PAD.l - PAD.r) / 2 : (i / (points.length - 1)) * (W - PAD.l - PAD.r));
  const sy = (v: number) => PAD.t + (1 - (v - min) / (max - min || 1)) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const area = `${path} L${sx(points.length - 1)},${H - PAD.b} L${sx(0)},${H - PAD.b} Z`;
  const ticks = [min, (min + max) / 2, max];
  const fx = formatX ?? ((x: string) => x.slice(5));
  const labelIdx = points.length <= 4 ? points.map((_, i) => i) : [0, Math.floor(points.length / 2), points.length - 1];
  const active = hover ?? points.length - 1;
  return (
    <figure className={cn("w-full", className)}>
      <figcaption className="sr-only">
        {label}: {points.length} points, from {points[0].y}
        {unit} to {points[points.length - 1].y}
        {unit}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="var(--line)" strokeDasharray="3 4" />
            <text x={PAD.l - 6} y={sy(t) + 4} textAnchor="end" fontSize="11" fill="var(--fg-subtle)">
              {Math.round(t * 10) / 10}
            </text>
          </g>
        ))}
        {points.length > 1 ? <path d={area} fill={`url(#${id})`} /> : null}
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <rect x={sx(i) - (W / points.length) / 2} y={0} width={W / points.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
            <circle cx={sx(i)} cy={sy(p.y)} r={i === active ? 5 : points.length > 40 ? 0 : 3} fill={i === active ? color : "var(--surface)"} stroke={color} strokeWidth="2" />
          </g>
        ))}
        {labelIdx.map((i) => (
          <text key={i} x={sx(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--fg-subtle)">
            {fx(points[i].x)}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex items-baseline justify-between text-xs text-muted" aria-hidden>
        <span>{fx(points[active].x)}</span>
        <span className="num font-semibold text-fg">
          {Math.round(points[active].y * 10) / 10}
          {unit}
        </span>
      </div>
    </figure>
  );
}

export function BarChart({ data, unit = "", color = "var(--accent)", label, className, formatX }: { data: Point[]; unit?: string; color?: string; label: string; className?: string; formatX?: (x: string) => string }) {
  if (data.length === 0) return <ChartEmpty className={className} />;
  const max = Math.max(...data.map((d) => d.y), 1);
  const bw = (W - PAD.l - PAD.r) / data.length;
  const fx = formatX ?? ((x: string) => x.slice(5));
  const step = Math.max(1, Math.ceil(data.length / 6));
  return (
    <figure className={cn("w-full", className)}>
      <figcaption className="sr-only">{label}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + (1 - t) * (H - PAD.t - PAD.b)} y2={PAD.t + (1 - t) * (H - PAD.t - PAD.b)} stroke="var(--line)" strokeDasharray="3 4" />
            <text x={PAD.l - 6} y={PAD.t + (1 - t) * (H - PAD.t - PAD.b) + 4} textAnchor="end" fontSize="11" fill="var(--fg-subtle)">
              {Math.round(max * t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const h = (d.y / max) * (H - PAD.t - PAD.b);
          return (
            <g key={d.x}>
              <title>{`${fx(d.x)}: ${Math.round(d.y)}${unit}`}</title>
              <rect x={PAD.l + i * bw + bw * 0.18} y={H - PAD.b - h} width={bw * 0.64} height={Math.max(h, d.y > 0 ? 2 : 0)} rx={3} fill={color} opacity={d.y > 0 ? 1 : 0.2} />
              {i % step === 0 ? (
                <text x={PAD.l + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--fg-subtle)">
                  {fx(d.x)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Horizontal bars, ideal for muscle-group split. */
export function HBars({ data, label, className }: { data: Array<{ label: string; value: number }>; label: string; className?: string }) {
  if (data.length === 0) return <ChartEmpty className={className} />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul aria-label={label} className={cn("space-y-2.5", className)}>
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="truncate text-muted">{d.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${(d.value / max) * 100}%` }} />
          </span>
          <span className="num text-right font-semibold">{d.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Circular progress ring with centred content. */
export function Ring({ value, max, size = 132, stroke = 12, color = "var(--accent)", children, label }: { value: number; max: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(value)} of ${Math.round(max)}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={over ? "var(--danger)" : color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Month calendar with workout days highlighted. */
export function CalendarHeatmap({ month, days, onSelect, selected }: { month: string; days: Record<string, number>; onSelect?: (day: string) => void; selected?: string | null }) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: Array<string | null> = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  return (
    <div role="group" aria-label={`Workouts in ${first.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}`}>
      <div className="mb-1 grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium uppercase text-subtle" aria-hidden>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) =>
          d === null ? (
            <span key={`b${i}`} />
          ) : (
            <button
              key={d}
              type="button"
              onClick={() => onSelect?.(d)}
              aria-label={`${d}${days[d] ? `, ${days[d]} workout${days[d] > 1 ? "s" : ""}` : ""}`}
              aria-pressed={selected === d}
              className={cn("num aspect-square rounded-lg text-sm transition-colors", days[d] ? "bg-accent font-bold text-accent-fg" : "bg-surface-2 text-muted hover:bg-surface-3", selected === d && "ring-2 ring-fg")}
            >
              {Number(d.slice(8))}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

function ChartEmpty({ className }: { className?: string }) {
  return <div className={cn("flex h-40 items-center justify-center rounded-xl bg-surface-2 text-sm text-subtle", className)}>No data in this range yet</div>;
}
