"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/client/cn";

/** Simple controlled tab strip (underline style). Panels are rendered by the caller. */
export function Tabs<T extends string>({ value, onChange, tabs, label, className }: { value: T; onChange: (v: T) => void; tabs: Array<{ value: T; label: ReactNode }>; label: string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          type="button"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn("relative min-h-11 shrink-0 px-4 text-sm font-semibold transition-colors", value === t.value ? "text-fg" : "text-subtle hover:text-fg")}
        >
          {t.label}
          {value === t.value ? <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" /> : null}
        </button>
      ))}
    </div>
  );
}
