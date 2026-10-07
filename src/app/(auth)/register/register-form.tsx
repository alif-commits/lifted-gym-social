"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { registerSchema } from "@/lib/validators/auth";
import { ApiClientError, get, post, qs } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { GoogleButton } from "@/components/app/google-button";
import { AuthCard, FormError } from "../auth-form";

type Values = { email: string; password: string; username: string; displayName: string };

const rules = [
  { label: "10+ characters", test: (p: string) => p.length >= 10 },
  { label: "A letter", test: (p: string) => /[a-zA-Z]/.test(p) },
  { label: "A number", test: (p: string) => /[0-9]/.test(p) },
];

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<{ name: string; free: boolean } | null>(null);
  const { register, handleSubmit, formState, control, setError: setFieldError } = useForm<Values>({ resolver: zodResolver(registerSchema.omit({ timezone: true })), mode: "onTouched" });
  const username = useWatch({ control, name: "username" }) ?? "";
  const password = useWatch({ control, name: "password" }) ?? "";

  // Debounced username availability check; the status is derived from the last answered name.
  const candidate = username.trim().toLowerCase();
  const validName = /^[a-z0-9_]{3,20}$/.test(candidate);
  const availability: "idle" | "checking" | "free" | "taken" = !validName ? "idle" : checked?.name === candidate ? (checked.free ? "free" : "taken") : "checking";
  useEffect(() => {
    if (!validName) return;
    const t = setTimeout(() => {
      get<{ available: boolean }>(`/username-available${qs({ username: candidate })}`)
        .then((r) => setChecked({ name: candidate, free: r.available }))
        .catch(() => setChecked(null));
    }, 400);
    return () => clearTimeout(t);
  }, [candidate, validName]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await post("/auth/register", { ...values, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      router.replace("/feed");
      router.refresh();
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 409) {
        const msg = e.message.toLowerCase();
        if (msg.includes("username")) setFieldError("username", { message: e.message });
        else if (msg.includes("email")) setFieldError("email", { message: e.message });
        else setError(e.message);
      } else setError(e instanceof Error ? e.message : "Something went wrong");
    }
  });

  return (
    <AuthCard
      title="Join the floor"
      subtitle="Free forever. Log workouts, track nutrition, share progress."
      footer={
        <>
          Already training with us?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <GoogleButton label="Continue with Google" divider="or email" />
        <Field label="Display name" error={formState.errors.displayName?.message}>
          {(p) => <Input {...p} autoComplete="name" autoFocus {...register("displayName")} />}
        </Field>
        <Field
          label="Username"
          error={formState.errors.username?.message ?? (availability === "taken" ? "That username is taken" : undefined)}
          hint={availability === "free" ? "Nice, it's yours." : "3–20 letters, numbers or underscores."}
        >
          {(p) => (
            <div className="relative">
              <Input {...p} autoCapitalize="none" autoComplete="username" spellCheck={false} {...register("username")} className="pr-10" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden>
                {availability === "free" ? <Check className="h-4 w-4 text-success" /> : availability === "taken" ? <X className="h-4 w-4 text-danger" /> : null}
              </span>
            </div>
          )}
        </Field>
        <Field label="Email" error={formState.errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...register("email")} />}
        </Field>
        <Field label="Password" error={formState.errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...register("password")} />}
        </Field>
        <ul className="flex flex-wrap gap-2" aria-label="Password requirements">
          {rules.map((r) => {
            const ok = r.test(password);
            return (
              <li key={r.label} className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", ok ? "bg-success/15 text-success" : "bg-surface-2 text-subtle")}>
                {ok ? <Check className="h-3 w-3" aria-hidden /> : null}
                {r.label}
              </li>
            );
          })}
        </ul>
        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting} disabled={availability === "taken"}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
