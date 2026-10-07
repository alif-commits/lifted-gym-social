"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, Input, Switch, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/overlay";
import { errorMessage, get, put } from "@/lib/client/api";

type Site = {
  siteName: string;
  tagline: string;
  supportEmail: string | null;
  registrationOpen: boolean;
  googleSignupOpen: boolean;
  googleConfigured: boolean;
  maintenanceMode: boolean;
  announcement: string | null;
};

export function SiteSettingsTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => get<Site>("/admin/settings") });
  const [draft, setDraft] = useState<Site | null>(null);
  const form = draft ?? q.data ?? null;

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("Nothing to save");
      return put<Site>("/admin/settings", {
        siteName: form.siteName,
        tagline: form.tagline,
        supportEmail: form.supportEmail ?? "",
        registrationOpen: form.registrationOpen,
        googleSignupOpen: form.googleSignupOpen,
        maintenanceMode: form.maintenanceMode,
        announcement: form.announcement ?? "",
      });
    },
    onSuccess: (data) => {
      setDraft(null);
      qc.setQueryData(["admin", "settings"], data);
      qc.invalidateQueries({ queryKey: ["site"] });
      toast.success("Site settings saved");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (q.isLoading || !form) return <Skeleton className="h-80" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;

  const set = <K extends keyof Site>(key: K, value: Site[K]) => setDraft((s) => ({ ...(s ?? q.data!), [key]: value }));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Card className="space-y-4 p-5">
        <h2 className="display text-2xl">Website</h2>
        <Field label="Site name" hint="Shown on the maintenance screen and in public site info.">
          {(p) => <Input {...p} value={form.siteName} onChange={(e) => set("siteName", e.target.value)} maxLength={40} />}
        </Field>
        <Field label="Tagline" optional>
          {(p) => <Input {...p} value={form.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={120} />}
        </Field>
        <Field label="Support email" optional hint="Shown when the site is in maintenance.">
          {(p) => <Input {...p} type="email" value={form.supportEmail ?? ""} onChange={(e) => set("supportEmail", e.target.value || null)} />}
        </Field>
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="display text-2xl">Access</h2>
        <Switch
          checked={form.registrationOpen}
          onChange={(v) => set("registrationOpen", v)}
          label="Open registration"
          description="When off, new email and Google accounts are rejected. Existing members can still sign in."
        />
        <Switch
          checked={form.googleSignupOpen}
          onChange={(v) => set("googleSignupOpen", v)}
          disabled={!form.googleConfigured || !form.registrationOpen}
          label="Allow Google sign-up"
          description={form.googleConfigured ? "Existing Google users can still sign in when this is off." : "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google."}
        />
        <Switch
          checked={form.maintenanceMode}
          onChange={(v) => set("maintenanceMode", v)}
          label="Maintenance mode"
          description="Members see a holding page. Staff can still use the app and this console."
        />
      </Card>

      <Card className="space-y-4 p-5">
        <h2 className="display text-2xl">Announcement</h2>
        <Field label="Banner" optional hint="Shown at the top of the app for signed-in members. Leave blank to hide.">
          {(p) => <Textarea {...p} value={form.announcement ?? ""} onChange={(e) => set("announcement", e.target.value || null)} maxLength={240} />}
        </Field>
      </Card>

      <Button type="submit" loading={save.isPending}>
        Save settings
      </Button>
    </form>
  );
}
