"use client";

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/client/cn";

const control =
  "w-full rounded-xl border border-line bg-surface-2 px-3.5 text-fg placeholder:text-subtle transition-colors hover:border-line-strong focus:border-accent focus:outline-none focus-visible:outline-none aria-[invalid=true]:border-danger disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, "h-11 text-sm", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-24 py-3 text-sm leading-relaxed", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(control, "h-11 appearance-none bg-[length:16px] bg-[right_0.8rem_center] bg-no-repeat pr-9 text-sm", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239aa1ab' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
});

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, hint, error, children, className, optional }: { label: string; hint?: string; error?: string; children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode; className?: string; optional?: boolean }) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-center justify-between text-sm font-medium text-fg">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-subtle">Optional</span> : null}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-subtle">{description}</span> : null}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50", checked ? "bg-accent" : "bg-surface-3")}
      >
        <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

/** Segmented single-choice control. */
export function Segmented<T extends string>({ value, onChange, options, label, className }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode }>; label: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-xl bg-surface-2 p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("min-h-9 rounded-lg px-3 text-sm font-medium transition-colors", value === o.value ? "bg-surface-3 text-fg shadow-sm" : "text-muted hover:text-fg")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Numeric input that keeps the raw text while typing ("12." stays "12.") and re-syncs when the value changes from outside. */
export const NumberInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & { value: number | null | undefined; onValue: (v: number | null) => void; integer?: boolean }>(function NumberInput({ value, onValue, integer, className, ...rest }, ref) {
  const external = value ?? null;
  const [raw, setRaw] = useState(external === null ? "" : String(external));
  const [seen, setSeen] = useState(external);
  if (seen !== external) {
    setSeen(external);
    const parsed = raw.trim() === "" ? null : Number(raw.replace(",", "."));
    if (parsed !== external) setRaw(external === null ? "" : String(external));
  }
  return (
    <Input
      ref={ref}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      className={cn("num", className)}
      value={raw}
      onChange={(e) => {
        const next = e.target.value;
        if (!/^[0-9]*[.,]?[0-9]*$/.test(next)) return;
        setRaw(next);
        if (next.trim() === "" || next === "." || next === ",") return onValue(null);
        const n = Number(next.replace(",", "."));
        if (Number.isFinite(n)) {
          setSeen(integer ? Math.trunc(n) : n);
          onValue(integer ? Math.trunc(n) : n);
        }
      }}
      {...rest}
    />
  );
});
