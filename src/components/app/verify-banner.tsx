"use client";

import { MailWarning } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/overlay";
import { errorMessage, post } from "@/lib/client/api";
import { useMe } from "@/lib/client/hooks";

type ResendResult = { delivered: boolean; verifyUrl: string | null };

/** Soft nudge: verification never blocks core features. */
export function VerifyBanner() {
  const me = useMe();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  if (me.emailVerified || dismissed) return null;

  async function confirm() {
    setSending(true);
    try {
      const r = await post<ResendResult>("/auth/resend-verification");
      if (r.verifyUrl && !r.delivered) {
        router.push(r.verifyUrl);
        return;
      }
      if (r.delivered) toast.success("Verification email sent. Check your inbox.");
      else if (r.verifyUrl) router.push(r.verifyUrl);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
      <MailWarning className="h-5 w-5 shrink-0 text-warning" aria-hidden />
      <p className="min-w-0 flex-1">
        {me.emailConfigured ? (
          <>Verify <strong>{me.email}</strong> so you can recover your account.</>
        ) : (
          <>Confirm <strong>{me.email}</strong> so you can recover your account. Mail isn’t set up on this server yet.</>
        )}
      </p>
      <Button size="sm" variant="outline" loading={sending} onClick={confirm}>
        {me.emailConfigured ? "Resend email" : "Confirm email"}
      </Button>
      <button type="button" onClick={() => setDismissed(true)} className="text-xs text-subtle hover:text-fg">
        Dismiss
      </button>
    </div>
  );
}
