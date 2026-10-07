"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { post, errorMessage } from "@/lib/client/api";
import { GoogleButton } from "@/components/app/google-button";
import { AuthCard, FormError } from "../auth-form";

const schema = z.object({ identifier: z.string().trim().min(1, "Enter your email or username"), password: z.string().min(1, "Enter your password") });
type Values = z.infer<typeof schema>;

/** Only same-site relative paths are allowed as post-login destinations (prevents open redirects). */
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/feed");

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const oauth = params.get("oauth");
  const [error, setError] = useState<string | null>(oauth === "denied" ? "Google sign-in was cancelled." : oauth === "error" ? params.get("reason") : null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await post("/auth/login", values);
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to log your next session."
      footer={
        <>
          New to Lifted?{" "}
          <Link href="/register" className="font-semibold text-accent hover:underline">
            Create an account
          </Link>
          <span className="mt-2 block">
            Staff?{" "}
            <Link href="/admin/login" className="font-semibold text-accent hover:underline">
              Admin sign in
            </Link>
          </span>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <GoogleButton next={next} divider="or email" />
        <Field label="Email or username" error={formState.errors.identifier?.message}>
          {(p) => <Input {...p} autoComplete="username" autoCapitalize="none" autoFocus {...register("identifier")} />}
        </Field>
        <Field label="Password" error={formState.errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" {...register("password")} />}
        </Field>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm text-muted hover:text-fg hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
