"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/feedback";
import { toast } from "@/components/ui/overlay";
import { errorMessage, post } from "@/lib/client/api";

export function MaintenanceView({ siteName, supportEmail }: { siteName: string; supportEmail: string | null }) {
  const qc = useQueryClient();
  const logout = useMutation({
    mutationFn: () => post("/auth/logout"),
    onSuccess: () => {
      qc.clear();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload drops signed-in client state
      window.location.href = "/login";
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <Logo href="/login" className="mb-8" />
      <Card className="w-full max-w-md space-y-4 p-6 text-center sm:p-8">
        <Wrench className="mx-auto h-8 w-8 text-accent" aria-hidden />
        <h1 className="display text-4xl">{siteName} is paused</h1>
        <p className="text-sm text-muted">We&apos;re doing a bit of maintenance. Members will be back on the floor shortly. Staff can still sign in.</p>
        {supportEmail ? (
          <p className="text-sm text-subtle">
            Need help?{" "}
            <a href={`mailto:${supportEmail}`} className="font-semibold text-accent hover:underline">
              {supportEmail}
            </a>
          </p>
        ) : null}
        <Button variant="secondary" loading={logout.isPending} onClick={() => logout.mutate()}>
          Log out
        </Button>
      </Card>
    </div>
  );
}
