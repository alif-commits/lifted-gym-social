"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, LogOut, Monitor } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge, Card, ErrorState, SectionTitle, Skeleton } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Dialog, toast } from "@/components/ui/overlay";
import { del, errorMessage, get, post } from "@/lib/client/api";
import { longDate, timeAgo } from "@/lib/client/format";
import { useMe } from "@/lib/client/hooks";
import { passwordSchema } from "@/lib/validators/auth";

type Session = { id: string; userAgent: string | null; ip: string; lastSeenAt: string; current: boolean };
type Export = { id: string; format: string; status: string; sizeBytes: number | null; createdAt: string; downloadUrl: string | null };

/** "Chrome on macOS"-style label from a raw user agent; falls back to the generic device label. */
function deviceLabel(ua: string | null) {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "device";
  return `${browser} on ${os}`;
}

export function AccountTab() {
  const me = useMe();
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  const logout = useMutation({
    mutationFn: () => post("/auth/logout"),
    onSuccess: () => {
      qc.clear();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload drops all signed-in client state
      window.location.href = "/login";
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="space-y-8">
      <Card className="flex items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm text-muted">Signed in as</p>
          <p className="truncate font-semibold">{me.email}</p>
        </div>
        <Button variant="secondary" loading={logout.isPending} onClick={() => logout.mutate()}><LogOut className="h-4 w-4" aria-hidden /> Log out</Button>
      </Card>

      <PasswordForm />
      <Sessions />
      <Exports />

      <section>
        <SectionTitle>Delete account</SectionTitle>
        <Card className="space-y-3 border-danger/40 p-5">
          <p className="text-sm text-muted">Permanently removes your profile, workouts, posts, nutrition logs, photos and all other data. This cannot be undone. Export your data first if you want a copy.</p>
          <Button variant="danger" onClick={() => setDeleting(true)}>Delete my account</Button>
        </Card>
      </section>
      <DeleteDialog open={deleting} onClose={() => setDeleting(false)} />
    </div>
  );
}

const passwordForm = z.object({ currentPassword: z.string().min(1, "Enter your current password"), newPassword: passwordSchema });

function PasswordForm() {
  const form = useForm<z.infer<typeof passwordForm>>({ resolver: zodResolver(passwordForm), defaultValues: { currentPassword: "", newPassword: "" } });
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: (v: z.infer<typeof passwordForm>) => post("/auth/change-password", v),
    onSuccess: () => { form.reset(); setError(null); toast.success("Password changed. Other devices were signed out."); },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <section>
      <SectionTitle>Change password</SectionTitle>
      <Card className="p-5">
        <form className="space-y-4" onSubmit={form.handleSubmit((v) => m.mutate(v))}>
          <Field label="Current password" error={form.formState.errors.currentPassword?.message}>{(p) => <Input {...p} type="password" autoComplete="current-password" {...form.register("currentPassword")} />}</Field>
          <Field label="New password" hint="At least 10 characters with a letter and a number." error={form.formState.errors.newPassword?.message}>{(p) => <Input {...p} type="password" autoComplete="new-password" {...form.register("newPassword")} />}</Field>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" loading={m.isPending}>Update password</Button>
        </form>
      </Card>
    </section>
  );
}

function Sessions() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["sessions"], queryFn: () => get<{ items: Session[] }>("/auth/sessions") });
  const revoke = useMutation({ mutationFn: (id: string) => del(`/auth/sessions/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["sessions"] }), onError: (e) => toast.error(errorMessage(e)) });
  return (
    <section>
      <SectionTitle>Active sessions</SectionTitle>
      {q.isLoading ? <Skeleton className="h-24" /> : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : (
        <Card className="divide-y divide-line">
          {q.data!.items.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <Monitor className="h-5 w-5 shrink-0 text-subtle" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-medium">{deviceLabel(s.userAgent)} {s.current ? <Badge tone="accent">This device</Badge> : null}</p>
                <p className="text-xs text-subtle">Active {timeAgo(s.lastSeenAt)} · {s.ip}</p>
              </div>
              {!s.current ? <Button size="sm" variant="secondary" onClick={() => revoke.mutate(s.id)}>Sign out</Button> : null}
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}

function Exports() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["exports"],
    queryFn: () => get<Export[]>("/me/exports"),
    refetchInterval: (query) => (query.state.data?.some((e) => e.status === "PENDING") ? 2000 : false),
  });
  const request = useMutation({
    mutationFn: (format: "JSON" | "CSV") => post("/me/exports", { format }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exports"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <section>
      <SectionTitle>Export your data</SectionTitle>
      <Card className="space-y-4 p-5">
        <p className="text-sm text-muted">Download a copy of your profile, workouts, nutrition logs and progress data. Files are available for a limited time.</p>
        <div className="flex gap-2">
          <Button variant="secondary" loading={request.isPending} onClick={() => request.mutate("JSON")}>Request JSON</Button>
          <Button variant="secondary" loading={request.isPending} onClick={() => request.mutate("CSV")}>Request CSV</Button>
        </div>
        {q.data?.length ? (
          <ul className="divide-y divide-line text-sm">
            {q.data.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <span>{e.format} · {longDate(e.createdAt)}</span>
                {e.downloadUrl ? <a href={e.downloadUrl} className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"><Download className="h-4 w-4" aria-hidden /> Download</a> : <Badge tone={e.status === "FAILED" ? "danger" : "neutral"}>{e.status === "PENDING" ? "Preparing…" : e.status === "FAILED" ? "Failed" : "Expired"}</Badge>}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </section>
  );
}

function DeleteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => del("/me", { password, confirm: "DELETE" }),
    onSuccess: () => {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload drops all signed-in client state
      window.location.href = "/";
    },
    onError: (e) => setError(errorMessage(e)),
  });
  return (
    <Dialog open={open} onClose={onClose} title="Delete your account?">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (confirm === "DELETE") m.mutate(); }}>
        <p className="text-sm text-muted">This permanently deletes everything and cannot be undone.</p>
        <Field label="Password">{(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}</Field>
        <Field label="Type DELETE to confirm">{(p) => <Input {...p} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" required />}</Field>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" variant="danger" loading={m.isPending} disabled={confirm !== "DELETE" || !password}>Delete forever</Button></div>
      </form>
    </Dialog>
  );
}
