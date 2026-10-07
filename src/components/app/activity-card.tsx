"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, Flag, Globe, Heart, Link2, Lock, MessageCircle, MoreHorizontal, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/feedback";
import { toast } from "@/components/ui/overlay";
import { del, errorMessage, post } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { formatDuration, formatVolume, formatWeight, pluralize, timeAgo, trim } from "@/lib/client/format";
import { useOptionalMe, useUnits } from "@/lib/client/hooks";
import type { ActivityCard as Card } from "@/lib/client/types";
import { PhotoGrid } from "./photo-grid";
import { ReportDialog } from "./report-dialog";
import { RichText } from "./rich-text";

const VIS = { PUBLIC: { icon: Globe, label: "Public" }, FOLLOWERS: { icon: Users, label: "Followers" }, PRIVATE: { icon: Lock, label: "Only me" } } as const;

export function SetSummary({ best }: { best: Card["summary"][number]["best"] }) {
  const units = useUnits();
  if (best.weight && best.reps) return <>{formatWeight(best.weight, units)} × {best.reps}</>;
  if (best.reps) return <>{best.reps} reps</>;
  if (best.durationSeconds) return <>{formatDuration(best.durationSeconds)}</>;
  if (best.distance) return <>{trim(Math.round(best.distance * 10) / 10)} km</>;
  return <>–</>;
}

export function ActivityCard({ activity: a, className }: { activity: Card; className?: string }) {
  const units = useUnits();
  const me = useOptionalMe();
  const router = useRouter();
  const qc = useQueryClient();
  const [liked, setLiked] = useState(a.likedByMe);
  const [likes, setLikes] = useState(a.likesCount);
  const [marked, setMarked] = useState(a.bookmarkedByMe);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const vis = VIS[a.visibility as keyof typeof VIS] ?? VIS.PUBLIC;
  const href = `/a/${a.shortId}`;
  const when = a.publishedAt ?? a.startedAt;

  const requireAuth = () => {
    if (me) return false;
    router.push(`/login?next=${encodeURIComponent(href)}`);
    return true;
  };

  async function toggleLike() {
    if (requireAuth()) return;
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1)); // optimistic
    try {
      const r = await (next ? post<{ likesCount: number }>(`/activities/${a.id}/like`) : del<{ likesCount: number }>(`/activities/${a.id}/like`));
      setLikes(r.likesCount);
    } catch (e) {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
      toast.error(errorMessage(e));
    }
  }

  async function toggleBookmark() {
    if (requireAuth()) return;
    const next = !marked;
    setMarked(next);
    try {
      await (next ? post(`/activities/${a.id}/bookmark`) : del(`/activities/${a.id}/bookmark`));
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
    } catch (e) {
      setMarked(!next);
      toast.error(errorMessage(e));
    }
  }

  async function copyLink() {
    setMenu(false);
    try {
      await navigator.clipboard.writeText(`${location.origin}${href}`);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  return (
    <article className={cn("rounded-2xl border border-line bg-surface shadow-card", className)} aria-label={`${a.title} by ${a.user.displayName}`}>
      <header className="flex items-center gap-3 p-4 pb-3">
        <Link href={`/u/${a.user.username}`} aria-label={`${a.user.displayName}'s profile`}>
          <Avatar name={a.user.displayName} src={a.user.avatarUrl} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/u/${a.user.username}`} className="block truncate font-semibold hover:underline">
            {a.user.displayName}
          </Link>
          <p className="flex items-center gap-1.5 text-xs text-subtle">
            <span>@{a.user.username}</span>·<time dateTime={when}>{timeAgo(when)}</time>·
            <span className="inline-flex items-center gap-1" title={vis.label}>
              <vis.icon className="h-3 w-3" aria-hidden />
              <span className="sr-only">{vis.label}</span>
            </span>
          </p>
        </div>
        <div className="relative">
          <button type="button" aria-label="More actions" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="flex h-10 w-10 items-center justify-center rounded-full text-subtle hover:bg-surface-2 hover:text-fg">
            <MoreHorizontal className="h-5 w-5" aria-hidden />
          </button>
          {menu ? (
            <>
              <button type="button" aria-label="Close menu" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} />
              <div role="menu" className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-line-strong bg-surface-2 py-1 shadow-card">
                <button role="menuitem" type="button" onClick={copyLink} className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-surface-3">
                  <Link2 className="h-4 w-4" aria-hidden /> Copy link
                </button>
                {a.user.id !== me?.id ? (
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      if (!requireAuth()) setReporting(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-danger hover:bg-surface-3"
                  >
                    <Flag className="h-4 w-4" aria-hidden /> Report
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </header>

      <div className="px-4">
        <Link href={href} className="group block">
          <h3 className="display text-3xl group-hover:text-accent">{a.title}</h3>
        </Link>
        {a.description ? <RichText text={a.description} className="mt-1 text-sm text-muted" /> : null}
      </div>

      <dl className="mx-4 mt-3 grid grid-cols-4 gap-2 rounded-xl bg-surface-2 p-3 text-center">
        {[
          ["Time", formatDuration(a.durationSeconds)],
          ["Volume", a.volume ? formatVolume(a.volume, units) : "–"],
          ["Sets", String(a.setCount)],
          ["PRs", String(a.prCount)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] font-medium uppercase tracking-wider text-subtle">{label}</dt>
            <dd className={cn("display num text-xl sm:text-2xl", label === "PRs" && a.prCount > 0 && "text-accent")}>{value}</dd>
          </div>
        ))}
      </dl>

      {a.photos.length ? <PhotoGrid photos={a.photos} href={href} className="mt-3" /> : null}

      {a.summary.length ? (
        <ul className="mx-4 mt-3 space-y-1.5 text-sm">
          {a.summary.slice(0, 3).map((s) => (
            <li key={s.exerciseId} className="flex items-center justify-between gap-3">
              <span className="truncate">
                <span className="num text-subtle">{s.sets}×</span> {s.name}
              </span>
              <span className="num shrink-0 text-muted">
                <SetSummary best={s.best} />
              </span>
            </li>
          ))}
          {a.summary.length > 3 ? (
            <li>
              <Link href={href} className="text-xs font-semibold text-accent hover:underline">
                +{pluralize(a.summary.length - 3, "more exercise")}
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}

      {a.prCount > 0 || a.hashtags.length ? (
        <div className="mx-4 mt-3 flex flex-wrap items-center gap-1.5">
          {a.prCount > 0 ? (
            <Badge tone="accent">
              <Trophy className="h-3 w-3" aria-hidden /> {pluralize(a.prCount, "PR")}
            </Badge>
          ) : null}
          {a.hashtags.slice(0, 5).map((t) => (
            <Link key={t} href={`/hashtag/${encodeURIComponent(t)}`} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted hover:text-accent">
              #{t}
            </Link>
          ))}
        </div>
      ) : null}

      <footer className="mt-3 flex items-center gap-1 border-t border-line px-2 py-1">
        <button type="button" onClick={toggleLike} aria-pressed={liked} aria-label={liked ? "Unlike" : "Like"} className={cn("flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-surface-2", liked ? "text-danger" : "text-muted")}>
          <Heart className={cn("h-5 w-5 transition-transform", liked && "scale-110 fill-current")} aria-hidden />
          <span className="num">{likes}</span>
        </button>
        <Link href={`${href}#comments`} className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface-2" aria-label={`${a.commentsCount} comments`}>
          <MessageCircle className="h-5 w-5" aria-hidden />
          <span className="num">{a.commentsCount}</span>
        </Link>
        <button type="button" onClick={toggleBookmark} aria-pressed={marked} aria-label={marked ? "Remove bookmark" : "Bookmark"} className={cn("ml-auto flex min-h-11 items-center rounded-xl px-3 hover:bg-surface-2", marked ? "text-accent" : "text-muted")}>
          <Bookmark className={cn("h-5 w-5", marked && "fill-current")} aria-hidden />
        </button>
      </footer>

      <ReportDialog target={reporting ? { targetType: "ACTIVITY", targetId: a.id } : null} onClose={() => setReporting(false)} />
    </article>
  );
}
