"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PersonRow } from "@/components/app/person-row";
import { Button } from "@/components/ui/button";
import { Card, ErrorState, SectionTitle, Skeleton } from "@/components/ui/feedback";
import { toast } from "@/components/ui/overlay";
import { del, errorMessage, get, post } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import type { UserSummary } from "@/lib/client/types";

type Request = { id: string; createdAt: string; user: UserSummary };

export function PeopleTab() {
  const qc = useQueryClient();
  const requests = useQuery({ queryKey: ["follow-requests"], queryFn: () => get<Request[]>("/me/follow-requests") });
  const blocked = useQuery({ queryKey: ["blocked"], queryFn: () => get<UserSummary[]>("/me/blocks") });
  const muted = useQuery({ queryKey: ["muted"], queryFn: () => get<UserSummary[]>("/me/mutes") });

  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => post(`/me/follow-requests/${id}`, { accept }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["follow-requests"] }); qc.invalidateQueries({ queryKey: ["unread"] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const undo = useMutation({
    mutationFn: ({ kind, username }: { kind: "block" | "mute"; username: string }) => del(`/users/${username}/${kind}`),
    onSuccess: (_r, v) => qc.invalidateQueries({ queryKey: [v.kind === "block" ? "blocked" : "muted"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const section = (title: string, q: typeof blocked, kind: "block" | "mute", empty: string) => (
    <section>
      <SectionTitle>{title}</SectionTitle>
      {q.isLoading ? <Skeleton className="h-20" /> : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : q.data?.length ? (
        <Card className="divide-y divide-line">
          {q.data.map((u) => <div key={u.id} className="px-4 py-2"><PersonRow user={u} action={<Button size="sm" variant="secondary" onClick={() => undo.mutate({ kind, username: u.username })}>{kind === "block" ? "Unblock" : "Unmute"}</Button>} /></div>)}
        </Card>
      ) : <p className="text-sm text-muted">{empty}</p>}
    </section>
  );

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle>Follow requests</SectionTitle>
        {requests.isLoading ? <Skeleton className="h-20" /> : requests.isError ? <ErrorState message={requests.error.message} onRetry={() => requests.refetch()} /> : requests.data?.length ? (
          <Card className="divide-y divide-line">
            {requests.data.map((r) => (
              <div key={r.id} className="px-4 py-2">
                <PersonRow user={r.user} sub={timeAgo(r.createdAt)} action={<span className="flex gap-2"><Button size="sm" onClick={() => respond.mutate({ id: r.id, accept: true })}>Accept</Button><Button size="sm" variant="secondary" onClick={() => respond.mutate({ id: r.id, accept: false })}>Decline</Button></span>} />
              </div>
            ))}
          </Card>
        ) : <p className="text-sm text-muted">No pending requests.</p>}
      </section>
      {section("Muted", muted, "mute", "You haven't muted anyone. Muted people stay followed but vanish from your feed.")}
      {section("Blocked", blocked, "block", "You haven't blocked anyone.")}
    </div>
  );
}
