"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { toast } from "@/components/ui/overlay";
import { errorMessage, post } from "@/lib/client/api";
import { AuthCard, FormError } from "../auth-form";

export function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <AuthCard title="Link expired" footer={<Link href="/forgot-password" className="font-semibold text-accent hover:underline">Request a new link</Link>}>
        <p className="text-sm text-muted">This reset link is missing or invalid.</p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="New password" subtitle="Pick something strong. You'll be signed out on other devices.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setError(null);
          try {
            await post("/auth/reset-password", { token, password });
            toast.success("Password updated. Sign in with your new password.");
            router.replace("/login");
          } catch (err) {
            setError(errorMessage(err));
          } finally {
            setLoading(false);
          }
        }}
      >
        <FormError message={error} />
        <Field label="New password" hint="10+ characters with a letter and a number.">{(p) => <Input {...p} type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />}</Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Update password
        </Button>
      </form>
    </AuthCard>
  );
}
