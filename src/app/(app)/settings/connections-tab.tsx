"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge, Card, ErrorState, SectionTitle, Skeleton } from "@/components/ui/feedback";
import { toast } from "@/components/ui/overlay";
import { GoogleButton } from "@/components/app/google-button";
import { errorMessage, get, post } from "@/lib/client/api";

type Connections = {
  google: { configured: boolean; linked: boolean };
  strava: { configured: boolean; connected: boolean; athleteName?: string | null; lastSyncedAt?: string | null };
};

export function ConnectionsTab() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const q = useQuery({ queryKey: ["connections"], queryFn: () => get<Connections>("/me/connections") });
  const unlink = useMutation({
    mutationFn: () => post("/auth/google/unlink"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["connections"] }); toast.success("Google disconnected"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const sync = useMutation({
    mutationFn: () => post<{ imported: number; skipped: number }>("/integrations/strava/sync"),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["connections"] }); qc.invalidateQueries({ queryKey: ["workouts"] }); toast.success(r.imported ? `Imported ${r.imported} Strava activities` : "Already up to date"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const disconnect = useMutation({
    mutationFn: () => post("/integrations/strava/disconnect"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["connections"] }); toast.success("Strava disconnected. Imported workouts stay in your history."); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading) return <Skeleton className="h-48" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const c = q.data!;
  const stravaFlash = params.get("strava");

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle>Google</SectionTitle>
        <Card className="space-y-3 p-5">
          {c.google.linked ? (
            <>
              <p className="text-sm text-muted">Your Google account is linked. You can keep using email and password as well.</p>
              <Button variant="secondary" loading={unlink.isPending} onClick={() => unlink.mutate()}>Disconnect Google</Button>
            </>
          ) : c.google.configured ? (
            <>
              <p className="text-sm text-muted">Link Google for faster sign-in. Your existing password still works.</p>
              <GoogleButton intent="link" next="/settings?tab=connections" label="Link Google" />
            </>
          ) : (
            <p className="text-sm text-muted">Google sign-in isn’t configured on this server yet.</p>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle>Strava</SectionTitle>
        <Card className="space-y-3 p-5">
          <p className="text-xs text-subtle">LIFTED is not sponsored by or affiliated with Strava. Imported activities are copies for your log.</p>
          {stravaFlash === "connected" ? <Badge tone="success">Connected</Badge> : null}
          {stravaFlash === "denied" || stravaFlash === "error" ? <p className="text-sm text-danger">Strava authorization didn’t finish. Try again.</p> : null}
          {c.strava.connected ? (
            <>
              <p className="text-sm">Connected{c.strava.athleteName ? ` as ${c.strava.athleteName}` : ""}.</p>
              {c.strava.lastSyncedAt ? <p className="text-xs text-subtle">Last sync {new Date(c.strava.lastSyncedAt).toLocaleString()}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => sync.mutate()} loading={sync.isPending}>Sync now</Button>
                <Button variant="secondary" onClick={() => disconnect.mutate()} loading={disconnect.isPending}>Disconnect</Button>
              </div>
              <p className="text-xs text-subtle">Disconnect stops future imports and keeps workouts already copied into LIFTED.</p>
            </>
          ) : c.strava.configured ? (
            <>
              <p className="text-sm text-muted">Import eligible Strava activities one-way into your LIFTED history. Native LIFTED workouts stay first-class.</p>
              <a href="/api/v1/integrations/strava" className={buttonClass("primary", "md")}>
                Connect Strava
              </a>
            </>
          ) : (
            <p className="text-sm text-muted">Strava isn’t configured on this server yet. Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET to enable it.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
