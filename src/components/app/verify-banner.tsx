"use client";

import { MailWarning } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/overlay";
import { errorMessage, post } from "@/lib/client/api";
import { useMe } from "@/lib/client/hooks";

/** Soft nudge: verification never blocks core features. */
export function VerifyBanner() {
  const me = useMe();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  if (me.emailVerified || dismissed) return null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
      <MailWarning className="h-5 w-5 shrink-0 text-warning" aria-hidden />
      <p className="min-w-0 flex-1">Verify <strong>{me.email}</strong> so you can recover your account.</p>
      <Button
        size="sm"
        variant="outline"
        loading={sending}
        onClick={async () => {
          setSending(true);
          try {
            await post("/auth/resend-verification");
            toast.success("Verification email sent");
          } catch (e) {
            toast.error(errorMessage(e));
          } finally {
            setSending(false);
          }
        }}
      >
        Resend email
      </Button>
      <button type="button" onClick={() => setDismissed(true)} className="text-xs text-subtle hover:text-fg">
        Dismiss
      </button>
    </div>
  );
}
