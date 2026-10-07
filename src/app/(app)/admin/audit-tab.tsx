"use client";

import { ScrollText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { get } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import type { UserSummary } from "@/lib/client/types";

type Row = {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  actor: UserSummary | null;
};

const LABELS: Record<string, string> = {
  "admin.site.update": "Updated site settings",
  "admin.user.update": "Updated an account",
  "auth.login": "Signed in",
  "auth.register": "Created an account",
  "auth.google_login": "Signed in with Google",
  "auth.google_register": "Joined with Google",
  "auth.google_link": "Linked Google",
  "auth.google_unlink": "Unlinked Google",
  "strava.connect": "Connected Strava",
};

export function AuditTab() {
  const q = useQuery({ queryKey: ["admin", "audit"], queryFn: () => get<{ items: Row[] }>("/admin/audit") });
  if (q.isLoading) return <Skeleton className="h-64" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const items = q.data?.items ?? [];
  if (items.length === 0) return <EmptyState icon={<ScrollText className="h-7 w-7" aria-hidden />} title="No activity yet" description="Staff actions and sign-ins will show up here." />;

  return (
    <ul className="space-y-2">
      {items.map((row) => (
        <li key={row.id}>
          <Card className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{LABELS[row.action] ?? row.action}</p>
              <p className="truncate text-xs text-subtle">
                {row.actor ? `${row.actor.displayName} · @${row.actor.username}` : "System"} · {row.entityType}
              </p>
            </div>
            <span className="shrink-0 text-xs text-subtle">{timeAgo(row.createdAt)}</span>
          </Card>
        </li>
      ))}
    </ul>
  );
}
