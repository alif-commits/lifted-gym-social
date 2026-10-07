"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, Heart, MessageCircle, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/form";
import { ConfirmDialog, toast } from "@/components/ui/overlay";
import { del, errorMessage, patch, post } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { timeAgo } from "@/lib/client/format";
import { useList, useOptionalMe } from "@/lib/client/hooks";
import type { CommentItem } from "@/lib/client/types";
import { InfiniteList } from "./infinite-list";
import { ReportDialog, type ReportTarget } from "./report-dialog";
import { RichText } from "./rich-text";

export function Comments({ activityId, redirectTo }: { activityId: string; redirectTo: string }) {
  const me = useOptionalMe();
  const router = useRouter();
  const qc = useQueryClient();
  const key = ["comments", activityId];
  const list = useList<CommentItem>(key, `/activities/${activityId}/comments`, { limit: 15 });
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["feed"] });
  };

  return (
    <section id="comments" aria-labelledby="comments-title" className="scroll-mt-20">
      <SectionTitle>
        <span id="comments-title">Comments</span>
      </SectionTitle>
      {me ? (
        <Composer activityId={activityId} parent={replyTo} onCancelReply={() => setReplyTo(null)} onPosted={() => { setReplyTo(null); refresh(); }} />
      ) : (
        <p className="mb-4 rounded-xl bg-surface-2 p-4 text-sm text-muted">
          <Link href={`/login?next=${encodeURIComponent(redirectTo)}`} className="font-semibold text-accent hover:underline">Sign in</Link> to join the conversation.
        </p>
      )}
      <InfiniteList
        list={list}
        items={list.items}
        className="space-y-5"
        skeletonCount={2}
        empty={<p className="py-6 text-center text-sm text-muted">No comments yet. Be the first.</p>}
        render={(c) => (
          <li key={c.id} className="list-none">
            <CommentView comment={c} onReply={() => (me ? setReplyTo(c) : router.push(`/login?next=${encodeURIComponent(redirectTo)}`))} onReport={setReport} onChanged={refresh} signedIn={!!me} />
            {c.replies.length ? (
              <ul className="ml-5 mt-3 space-y-4 border-l border-line pl-4">
                {c.replies.map((r) => (
                  <li key={r.id} className="list-none">
                    <CommentView comment={r} onReply={() => (me ? setReplyTo(c) : router.push(`/login?next=${encodeURIComponent(redirectTo)}`))} onReport={setReport} onChanged={refresh} signedIn={!!me} compact />
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        )}
        as="div"
      />
      <ReportDialog target={report} onClose={() => setReport(null)} />
    </section>
  );
}

function Composer({ activityId, parent, onCancelReply, onPosted }: { activityId: string; parent: CommentItem | null; onCancelReply: () => void; onPosted: () => void }) {
  const [text, setText] = useState("");
  const m = useMutation({
    mutationFn: () => post(`/activities/${activityId}/comments`, { text: text.trim(), parentCommentId: parent?.id }),
    onSuccess: () => {
      setText("");
      onPosted();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <form
      className="mb-5 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) m.mutate();
      }}
    >
      {parent ? (
        <p className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-1.5 text-xs text-muted">
          Replying to <strong className="text-fg">@{parent.user.username}</strong>
          <button type="button" onClick={onCancelReply} className="font-semibold hover:text-fg">Cancel</button>
        </p>
      ) : null}
      <Textarea aria-label="Write a comment" placeholder={parent ? "Write a reply" : "Add a comment"} rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex items-center justify-between">
        <span className="num text-xs text-subtle">{text.length}/1000</span>
        <Button type="submit" size="sm" loading={m.isPending} disabled={!text.trim()}>
          {parent ? "Reply" : "Comment"}
        </Button>
      </div>
    </form>
  );
}

function CommentView({ comment: c, onReply, onReport, onChanged, signedIn, compact }: { comment: CommentItem; onReply: () => void; onReport: (t: ReportTarget) => void; onChanged: () => void; signedIn: boolean; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.text);
  const [confirm, setConfirm] = useState(false);
  const [liked, setLiked] = useState(c.likedByMe);
  const [likes, setLikes] = useState(c.likesCount);

  const save = useMutation({
    mutationFn: () => patch(`/comments/${c.id}`, { text: text.trim() }),
    onSuccess: () => { setEditing(false); onChanged(); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => del(`/comments/${c.id}`),
    onSuccess: () => { setConfirm(false); onChanged(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  async function toggleLike() {
    if (!signedIn) return onReply();
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    try {
      const r = await (next ? post<{ likesCount: number }>(`/comments/${c.id}/like`) : del<{ likesCount: number }>(`/comments/${c.id}/like`));
      setLikes(r.likesCount);
    } catch (e) {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="flex gap-3">
      <Link href={`/u/${c.user.username}`} aria-label={`${c.user.displayName}'s profile`}>
        <Avatar name={c.user.displayName} src={c.user.avatarUrl} size={compact ? "xs" : "sm"} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <Link href={`/u/${c.user.username}`} className="font-semibold hover:underline">{c.user.displayName}</Link>{" "}
          <span className="text-xs text-subtle">{timeAgo(c.createdAt)}{c.edited ? " · edited" : ""}</span>
        </p>
        {editing ? (
          <div className="mt-1 space-y-2">
            <Textarea aria-label="Edit comment" rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" loading={save.isPending} disabled={!text.trim()} onClick={() => save.mutate()}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setText(c.text); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <RichText text={c.text} className="text-sm" />
        )}
        {!editing ? (
          <div className="-ml-2 mt-1 flex items-center gap-0.5 text-xs text-subtle">
            <button type="button" onClick={toggleLike} aria-pressed={liked} className={cn("flex min-h-9 items-center gap-1 rounded-lg px-2 hover:bg-surface-2", liked && "text-danger")}>
              <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} aria-hidden /> <span className="num">{likes}</span><span className="sr-only">likes</span>
            </button>
            <button type="button" onClick={onReply} className="flex min-h-9 items-center gap-1 rounded-lg px-2 hover:bg-surface-2">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Reply
            </button>
            {c.canEdit ? (
              <button type="button" onClick={() => setEditing(true)} className="flex min-h-9 items-center gap-1 rounded-lg px-2 hover:bg-surface-2">
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
              </button>
            ) : null}
            {c.canDelete ? (
              <button type="button" onClick={() => setConfirm(true)} className="flex min-h-9 items-center gap-1 rounded-lg px-2 hover:bg-danger-soft hover:text-danger">
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
              </button>
            ) : null}
            {signedIn && !c.canEdit ? (
              <button type="button" onClick={() => onReport({ targetType: "COMMENT", targetId: c.id })} className="flex min-h-9 items-center gap-1 rounded-lg px-2 hover:bg-surface-2">
                <Flag className="h-3.5 w-3.5" aria-hidden /> Report
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => remove.mutate()} loading={remove.isPending} danger title="Delete comment?" confirmLabel="Delete" message="This can't be undone." />
    </div>
  );
}
