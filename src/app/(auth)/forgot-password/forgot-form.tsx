"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { errorMessage, post } from "@/lib/client/api";
import { AuthCard, FormError } from "../auth-form";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "sent") {
    return (
      <AuthCard title="Check your inbox" footer={<Link href="/login" className="font-semibold text-accent hover:underline">Back to sign in</Link>}>
        <div className="flex flex-col items-center gap-3 text-center">
          <MailCheck className="h-12 w-12 text-accent" aria-hidden />
          <p className="text-sm text-muted">If an account exists for <strong className="text-fg">{email}</strong>, a reset link is on its way. It expires in one hour.</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset password" subtitle="Enter your email and we'll send a reset link." footer={<Link href="/login" className="font-semibold text-accent hover:underline">Back to sign in</Link>}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setState("loading");
          setError(null);
          try {
            await post("/auth/forgot-password", { email });
            setState("sent");
          } catch (err) {
            setError(errorMessage(err));
            setState("idle");
          }
        }}
      >
        <FormError message={error} />
        <Field label="Email">{(p) => <Input {...p} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />}</Field>
        <Button type="submit" size="lg" className="w-full" loading={state === "loading"}>
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}
