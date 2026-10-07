"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { errorMessage, post } from "@/lib/client/api";
import { AuthCard, FormError } from "../../auth-form";

const schema = z.object({ identifier: z.string().trim().min(1, "Enter your email or username"), password: z.string().min(1, "Enter your password") });
type Values = z.infer<typeof schema>;

const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/admin");

export function AdminLoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await post("/auth/admin-login", values);
      router.replace(next.startsWith("/admin") ? next : "/admin");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <AuthCard
      title="Staff sign in"
      subtitle="Admin and moderator access only."
      footer={
        <>
          Not staff?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Member sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError message={error} />
        <Field label="Email or username" error={formState.errors.identifier?.message}>
          {(p) => <Input {...p} autoComplete="username" autoCapitalize="none" autoFocus {...register("identifier")} />}
        </Field>
        <Field label="Password" error={formState.errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" {...register("password")} />}
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
          Continue to admin
        </Button>
      </form>
    </AuthCard>
  );
}
