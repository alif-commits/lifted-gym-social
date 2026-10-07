"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";
import { errorMessage, post } from "@/lib/client/api";
import { AuthCard } from "../auth-form";

export function VerifyEmail() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "" : "This verification link is missing a token.");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true; // tokens are single-use: never submit twice (React strict mode)
    post("/auth/verify-email", { token })
      .then(() => setState("ok"))
      .catch((e) => {
        setMessage(errorMessage(e));
        setState("error");
      });
  }, [token]);

  return (
    <AuthCard title="Email verification">
      <div className="flex flex-col items-center gap-4 py-4 text-center" aria-live="polite">
        {state === "loading" ? <Spinner className="h-8 w-8" label="Verifying" /> : null}
        {state === "ok" ? (
          <>
            <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
            <p className="font-semibold">You&apos;re verified.</p>
            <ButtonLink href="/feed">Continue to Lifted</ButtonLink>
          </>
        ) : null}
        {state === "error" ? (
          <>
            <XCircle className="h-12 w-12 text-danger" aria-hidden />
            <p className="text-sm text-muted">{message}</p>
            <Link href="/feed" className="text-sm font-semibold text-accent hover:underline">
              Back to the app
            </Link>
          </>
        ) : null}
      </div>
    </AuthCard>
  );
}
