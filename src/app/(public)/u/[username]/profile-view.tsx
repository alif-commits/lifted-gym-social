"use client";

import { useMutation } from "@tanstack/react-query";
import { Ban, CalendarDays, Flag, Lock, MoreHorizontal, Settings, Trophy, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActivityCard } from "@/components/app/activity-card";
import { FollowButton, type FollowState } from "@/components/app/follow-button";
import { InfiniteList } from "@/components/app/infinite-list";
import { PersonRow } from "@/components/app/person-row";
import { ReportDialog } from "@/components/app/report-dialog";
import { RichText } from "@/components/app/rich-text";
import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Card, EmptyState, SectionTitle, Skeleton, Stat } from "@/components/ui/feedback";
import { ConfirmDialog, Dialog, toast } from "@/components/ui/overlay";
import { del, errorMessage, post } from "@/lib/client/api";
import { formatDuration, formatVolume } from "@/lib/client/format";
import { useList, useOptionalMe, useUnits } from "@/lib/client/hooks";
import type { ActivityCard as Card_ } from "@/lib/client/types";
import type { getPublicProfile } from "@/server/services/users";
import type { Serialized } from "@/lib/client/api";

type Profile = Serialized<Awaited<ReturnType<typeof getPublicProfile>>>;
type Person = { id: string; username: string; displayName: string; avatarUrl: string | null; viewerState: FollowState | "SELF" };

export function ProfileView({ profile: p }: { profile: Profile }) {
  const router = useRouter();
  const me = useOptionalMe();
  const units = useUnits();
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [connections, setConnections] = useState<"followers" | "following" | null>(null);
  const list = useList<Card_>(["profile-activities", p.username], `/users/${p.username}/activities`, {}, p.canViewContent && !p.relation.blockedByMe);

  const initialFollow: FollowState = p.relation.following ? "FOLLOWING" : p.relation.requested ? "REQUESTED" : "NONE";
  const act = useMutation({
    mutationFn: ({ path, remove }: { path: string; remove: boolean }) => (remove ? del(`/users/${p.username}/${path}`) : post(`/users/${p.username}/${path}`)),
    onSuccess: () => router.refresh(),
    onError: (e) => toast.error(errorMessage(e)),
  });
  const needLogin = () => router.push(`/login?next=${encodeURIComponent(`/u/${p.username}`)}`);

  return (
    <div className="space-y-8">
      <Card as="section" className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={p.displayName} src={p.avatarUrl} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="display text-4xl sm:text-5xl">{p.displayName}</h1>
              {p.isPrivate ? <Lock className="h-4 w-4 text-subtle" aria-label="Private account" /> : null}
              {p.relation.followsYou ? <Badge>Follows you</Badge> : null}
            </div>
            <p className="text-sm text-subtle">@{p.username}</p>
            {p.bio ? <RichText text={p.bio} className="mt-3 text-sm" /> : null}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-subtle">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden /> Joined {new Date(p.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </p>
            <div className="mt-4 flex gap-6 text-sm">
              <button type="button" onClick={() => setConnections("followers")} className="hover:underline">
                <strong className="num">{p.counts.followers}</strong> <span className="text-muted">followers</span>
              </button>
              <button type="button" onClick={() => setConnections("following")} className="hover:underline">
                <strong className="num">{p.counts.following}</strong> <span className="text-muted">following</span>
              </button>
              <span>
                <strong className="num">{p.counts.activities}</strong> <span className="text-muted">posts</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:flex-col sm:items-end">
            {p.relation.isOwner ? (
              <ButtonLink href="/settings" variant="outline" size="sm">
                <Settings className="h-4 w-4" aria-hidden /> Edit profile
              </ButtonLink>
            ) : p.relation.blockedByMe ? (
              <Button size="sm" variant="outline" loading={act.isPending} onClick={() => act.mutate({ path: "block", remove: true })}>
                Unblock
              </Button>
            ) : me ? (
              <FollowButton username={p.username} initial={initialFollow} onChange={() => router.refresh()} />
            ) : (
              <Button size="sm" onClick={needLogin}>
                Follow
              </Button>
            )}
            {me && !p.relation.isOwner ? (
              <div className="relative">
                <button type="button" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="flex h-10 w-10 items-center justify-center rounded-full text-subtle hover:bg-surface-2 hover:text-fg">
                  <MoreHorizontal className="h-5 w-5" aria-hidden />
                </button>
                {menu ? (
                  <>
                    <button type="button" aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
                    <div role="menu" className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-line-strong bg-surface-2 py-1 shadow-card">
                      <button role="menuitem" type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-3" onClick={() => { setMenu(false); act.mutate({ path: "mute", remove: p.relation.muted }); }}>
                        <VolumeX className="h-4 w-4" aria-hidden /> {p.relation.muted ? "Unmute" : "Mute"}
                      </button>
                      {!p.relation.blockedByMe ? (
                        <button role="menuitem" type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-danger hover:bg-surface-3" onClick={() => { setMenu(false); setConfirmBlock(true); }}>
                          <Ban className="h-4 w-4" aria-hidden /> Block
                        </button>
                      ) : null}
                      <button role="menuitem" type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-danger hover:bg-surface-3" onClick={() => { setMenu(false); setReporting(true); }}>
                        <Flag className="h-4 w-4" aria-hidden /> Report
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      {p.relation.blockedByMe ? (
        <EmptyState icon={<Ban className="h-7 w-7" aria-hidden />} title="You blocked this athlete" description="Unblock them to see their posts again." />
      ) : !p.canViewContent ? (
        <EmptyState icon={<Lock className="h-7 w-7" aria-hidden />} title="This account is private" description={me ? "Follow to see their workouts. They'll need to approve your request." : "Sign in and follow to see their workouts."} />
      ) : (
        <>
          {p.stats && Object.keys(p.stats).length ? (
            <Card as="section" className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-5" aria-label="Statistics">
              {p.stats.workouts !== undefined ? <Stat label="Workouts" value={p.stats.workouts} /> : null}
              {p.stats.trainingSeconds !== undefined ? <Stat label="Time" value={formatDuration(p.stats.trainingSeconds)} /> : null}
              {p.stats.totalVolumeKg !== undefined ? <Stat label="Volume" value={formatVolume(p.stats.totalVolumeKg, units)} /> : null}
              {p.stats.prCount !== undefined ? <Stat label="PRs" value={p.stats.prCount} /> : null}
              {p.stats.streakWeeks !== undefined ? <Stat label="Streak" value={`${p.stats.streakWeeks}w`} /> : null}
            </Card>
          ) : null}
          {p.achievements.length ? (
            <section aria-label="Achievements" className="flex flex-wrap gap-2">
              {p.achievements.map((a) => (
                <span key={a.id} title={a.description} className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                  <Trophy className="h-3.5 w-3.5" aria-hidden /> {a.label}
                </span>
              ))}
            </section>
          ) : null}
          <section>
            <SectionTitle>Activity</SectionTitle>
            <InfiniteList list={list} items={list.items} skeleton={<Skeleton className="h-72" />} render={(a) => <ActivityCard key={a.id} activity={a} />} empty={<EmptyState title="No posts yet" description={p.relation.isOwner ? "Finish a workout and share it." : `${p.displayName} hasn't shared anything yet.`} action={p.relation.isOwner ? <ButtonLink href="/workout/new">Start a workout</ButtonLink> : undefined} />} />
          </section>
        </>
      )}

      <ReportDialog target={reporting ? { targetType: "PROFILE", targetId: p.id } : null} onClose={() => setReporting(false)} />
      <ConfirmDialog open={confirmBlock} onClose={() => setConfirmBlock(false)} onConfirm={() => { setConfirmBlock(false); act.mutate({ path: "block", remove: false }); }} danger title={`Block @${p.username}?`} confirmLabel="Block" message="You won't see each other's posts, and any follow between you is removed." />
      <Connections username={p.username} kind={connections} onClose={() => setConnections(null)} />
    </div>
  );
}

function Connections({ username, kind, onClose }: { username: string; kind: "followers" | "following" | null; onClose: () => void }) {
  const me = useOptionalMe();
  const list = useList<Person>(["connections", username, kind], `/users/${username}/${kind}`, {}, kind !== null);
  return (
    <Dialog open={kind !== null} onClose={onClose} title={kind === "following" ? "Following" : "Followers"} sheet>
      <InfiniteList
        as="div"
        className="divide-y divide-line"
        list={list}
        items={list.items}
        skeletonCount={4}
        skeleton={<Skeleton className="h-11" />}
        empty={<p className="py-8 text-center text-sm text-muted">{kind === "following" ? "Not following anyone yet." : "No followers yet."}</p>}
        render={(u) => (
          <div key={u.id} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) onClose(); }}>
            <PersonRow user={u} action={me && u.viewerState !== "SELF" ? <FollowButton username={u.username} initial={u.viewerState} /> : null} />
          </div>
        )}
      />
    </Dialog>
  );
}
