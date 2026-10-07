"use client";

import { Minus, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { clock } from "@/lib/client/format";

/** Countdown based on an absolute end time, so it stays accurate when the tab is throttled. */
export function RestTimer({ endsAt, onAdjust, onDismiss }: { endsAt: number; onAdjust: (deltaSeconds: number) => void; onDismiss: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const done = left === 0;

  useEffect(() => {
    if (done && "vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
  }, [done]);

  return (
    <div role="timer" aria-live="off" className="fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-accent/40 bg-surface-2 p-2 pl-4 shadow-2xl lg:bottom-6">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-subtle">{done ? "Rest over" : "Resting"}</p>
        <p className={`display num text-3xl ${done ? "text-accent" : ""}`}>{done ? "Go!" : clock(left)}</p>
      </div>
      <button type="button" aria-label="Subtract 15 seconds" onClick={() => onAdjust(-15)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-3 hover:bg-line-strong">
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" aria-label="Add 15 seconds" onClick={() => onAdjust(15)} className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-3 hover:bg-line-strong">
        <Plus className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" aria-label="Dismiss rest timer" onClick={onDismiss} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-3">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
