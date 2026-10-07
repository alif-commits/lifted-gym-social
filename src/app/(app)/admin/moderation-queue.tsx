"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { ConfirmDialog, toast } from "@/components/ui/overlay";
import { Tabs } from "@/components/ui/tabs";
import { errorMessage, get, post } from "@/lib/client/api";
import { timeAgo, titleCase } from "@/lib/client/format";

type Status = "OPEN" | "RESOLVED" | "DISMISSED";
type Report = { id: string; targetType: string; targetId: string; reason: string; details: string | null; createdAt: string; reporter: string };
type Action = "DISMISS" | "REMOVE_CONTENT" | "SUSPEND_USER";
type Queue = { counts: Partial<Record<Status, number>>; items: Report[] };

const ACTION_LABEL: Record<Action, string> = { DISMISS: "Dismiss", REMOVE_CONTENT: "Remove content", SUSPEND_USER: "Suspend user" };

export function ModerationQueue() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("OPEN");
  const [pending, setPending] = useState<{ report: Report; action: Action } | null>(null);
  const [reason, setReason] = useState("");
  const q = useQuery({ queryKey: ["admin", "reports", status], queryFn: () => get<Queue>(`/admin/reports?status=${status}`) });

  const resolve = useMutation({
    mutationFn: ({ report, action }: { report: Report; action: Action }) => post(`/admin/reports/${report.id}`, { action, reason: reason.trim() || null }),
    onSuccess: () => { setPending(null); setReason(""); qc.invalidateQueries({ queryKey: ["admin", "reports"] }); toast.success("Report resolved"); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader title="Moderation" subtitle="Review reports. Every action is logged." />
      <Tabs
        label="Report status"
        value={status}
        onChange={setStatus}
        className="mb-6"
        tabs={(["OPEN", "RESOLVED", "DISMISSED"] as const).map((s) => ({ value: s, label: `${titleCase(s)}${q.data?.counts[s] ? ` (${q.data.counts[s]})` : ""}` }))}
      />
      {q.isLoading ? <Skeleton className="h-48" /> : null}
      {q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : null}
      {q.data?.items.length === 0 ? <EmptyState icon={<ShieldCheck className="h-7 w-7" aria-hidden />} title="Nothing here" description={status === "OPEN" ? "The queue is clear." : "No reports with this status."} /> : null}
      <ul className="space-y-3">
        {q.data?.items.map((r) => (
          <li key={r.id}>
            <Card className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="danger">{titleCase(r.reason)}</Badge>
                <Badge>{titleCase(r.targetType)}</Badge>
                <span className="text-xs text-subtle">by @{r.reporter} · {timeAgo(r.createdAt)}</span>
              </div>
              {r.details ? <p className="text-sm">{r.details}</p> : null}
              <p className="break-all font-mono text-xs text-subtle">{r.targetId}</p>
              {status === "OPEN" ? (
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(ACTION_LABEL) as Action[]).filter((a) => a !== "REMOVE_CONTENT" || r.targetType !== "PROFILE").map((a) => (
                    <Button key={a} size="sm" variant={a === "DISMISS" ? "secondary" : "danger"} onClick={() => setPending({ report: r, action: a })}>{ACTION_LABEL[a]}</Button>
                  ))}
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => pending && resolve.mutate(pending)}
        loading={resolve.isPending}
        danger={pending?.action !== "DISMISS"}
        title={pending ? ACTION_LABEL[pending.action] : ""}
        confirmLabel={pending ? ACTION_LABEL[pending.action] : "Confirm"}
        message={
          <div className="space-y-3">
            <p>{pending?.action === "SUSPEND_USER" ? "The account owner is signed out everywhere and can't log in." : pending?.action === "REMOVE_CONTENT" ? "The reported content is deleted." : "No action is taken against the content."}</p>
            <Field label="Note" optional>{(p) => <Input {...p} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
          </div>
        }
      />
    </>
  );
}
