"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, Link2 } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog, toast } from "@/components/ui/overlay";
import { errorMessage, patch, post } from "@/lib/client/api";
import type { ActivityCard } from "@/lib/client/types";

type Format = "png" | "jpg" | "pdf";

export function ShareWorkoutDialog({
  open,
  onClose,
  activityId,
  shortId,
  isPublic,
  isOwner,
  workoutId,
}: {
  open: boolean;
  onClose: () => void;
  activityId?: string | null;
  shortId?: string | null;
  isPublic: boolean;
  isOwner?: boolean;
  workoutId?: string;
}) {
  const qc = useQueryClient();
  const [live, setLive] = useState<{ activityId: string; shortId: string; isPublic: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState<Format | null>(null);
  const [publishing, setPublishing] = useState(false);
  const current = live ?? { activityId: activityId ?? null, shortId: shortId ?? null, isPublic };
  const url = current.shortId ? `${typeof window !== "undefined" ? window.location.origin : ""}/a/${current.shortId}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  async function download(format: Format) {
    if (!current.activityId || !current.shortId) return;
    setDownloading(format);
    try {
      const res = await fetch(`/api/v1/activities/${current.activityId}/export?format=${format}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `lifted-${current.shortId}.${format}`;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      toast.error("Couldn't generate that file");
    } finally {
      setDownloading(null);
    }
  }

  async function publishPublic() {
    if (!workoutId) return;
    setPublishing(true);
    try {
      const draft = await post<ActivityCard>("/activities", { workoutId });
      await patch(`/activities/${draft.id}`, { visibility: "PUBLIC" });
      const published = await post<ActivityCard>(`/activities/${draft.id}/publish`);
      setLive({ activityId: published.id, shortId: published.shortId, isPublic: published.status === "PUBLISHED" && published.visibility === "PUBLIC" });
      qc.invalidateQueries({ queryKey: ["workout"] });
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      toast.success("Public summary is live");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Dialog open={open} onClose={() => { setLive(null); onClose(); }} title="Share workout" sheet>
      <div className="space-y-5">
        {current.isPublic && current.shortId ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">Anyone with this link can see the public summary.</p>
            <div className="flex gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-xs">{url}</code>
              <Button variant="secondary" onClick={copy}>
                {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                Copy
              </Button>
            </div>
            <ButtonLink href={`/a/${current.shortId}`} variant="outline" className="w-full" onClick={onClose}>
              <Link2 className="h-4 w-4" aria-hidden />
              Open public page
            </ButtonLink>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {isOwner ? "Publish a public summary to get a shareable URL. You can still download a card after that." : "A downloadable card is available when you can view this workout."}
            </p>
            {isOwner && workoutId ? (
              <Button className="w-full" onClick={publishPublic} loading={publishing}>
                Publish public summary
              </Button>
            ) : null}
            {isOwner && workoutId ? (
              <ButtonLink href={`/workouts/${workoutId}/publish`} variant="outline" className="w-full" onClick={onClose}>
                Customize post
              </ButtonLink>
            ) : null}
          </div>
        )}

        {current.activityId ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Download card</p>
            <div className="grid grid-cols-3 gap-2">
              {(["png", "jpg", "pdf"] as const).map((format) => (
                <Button key={format} variant="secondary" onClick={() => download(format)} loading={downloading === format} disabled={downloading !== null && downloading !== format}>
                  <Download className="h-4 w-4" aria-hidden />
                  {format.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
