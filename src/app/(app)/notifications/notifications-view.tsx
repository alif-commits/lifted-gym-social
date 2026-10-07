"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { InfiniteList } from "@/components/app/infinite-list";
import { PageHeader } from "@/components/app/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { post } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { timeAgo } from "@/lib/client/format";
import { useList } from "@/lib/client/hooks";
import type { NotificationItem } from "@/lib/client/types";

function hrefFor(n: NotificationItem): string | null {
  const p = n.payload as Record<string, string | undefined>;
  switch (n.type) {
    case "NEW_FOLLOWER":
    case "FOLLOW_ACCEPTED":
      return p.username ? `/u/${p.username}` : null;
    case "FOLLOW_REQUEST":
      return "/settings?tab=privacy";
    case "PR":
      return p.workoutId ? `/workouts/${p.workoutId}` : null;
    case "GOAL_MILESTONE":
      return "/progress?tab=goals";
    default:
      return p.activityId ? `/a/${p.activityId}${p.commentId ? "#comments" : ""}` : null;
  }
}

export function NotificationsView() {
  const qc = useQueryClient();
  const list = useList<NotificationItem>(["notifications"], "/notifications");
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["unread"] });
  };
  const readAll = useMutation({ mutationFn: () => post("/notifications/read-all"), onSuccess: refresh });
  const readOne = useMutation({ mutationFn: (id: string) => post(`/notifications/${id}/read`), onSuccess: refresh });
  const hasUnread = list.items.some((n) => !n.read);

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          hasUnread ? (
            <Button variant="outline" size="sm" loading={readAll.isPending} onClick={() => readAll.mutate()}>
              <CheckCheck className="h-4 w-4" aria-hidden /> Mark all read
            </Button>
          ) : null
        }
      />
      <InfiniteList
        as="ul"
        className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface"
        list={list}
        items={list.items}
        skeleton={<Skeleton className="h-16" />}
        empty={<EmptyState icon={<Bell className="h-7 w-7" aria-hidden />} title="All caught up" description="Likes, comments, follows and PRs will show up here." />}
        render={(n) => {
          const href = hrefFor(n);
          const body = (
            <div className={cn("flex items-start gap-3 px-4 py-3.5", !n.read && "bg-accent-soft/40")}>
              {n.actor ? <Avatar name={n.actor.displayName} src={n.actor.avatarUrl} size="sm" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent"><Bell className="h-4 w-4" aria-hidden /></span>}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{n.title}</p>
                <p className="text-sm text-muted [overflow-wrap:anywhere]">{n.message}</p>
                <p className="mt-0.5 text-xs text-subtle">{timeAgo(n.createdAt)}</p>
              </div>
              {!n.read ? <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label="Unread" /> : null}
            </div>
          );
          return (
            <li key={n.id}>
              {href ? (
                <Link
                  href={href}
                  className="block hover:bg-surface-2"
                  onClick={() => !n.read && readOne.mutate(n.id)}
                >
                  {body}
                </Link>
              ) : (
                <button type="button" className="block w-full text-left hover:bg-surface-2" onClick={() => !n.read && readOne.mutate(n.id)}>
                  {body}
                </button>
              )}
            </li>
          );
        }}
      />
    </>
  );
}
