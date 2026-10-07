"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActivityCard } from "@/components/app/activity-card";
import { Comments } from "@/components/app/comments";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Card, SectionTitle } from "@/components/ui/feedback";
import { ConfirmDialog, toast } from "@/components/ui/overlay";
import { del, errorMessage } from "@/lib/client/api";
import { formatDuration, formatWeight, trim } from "@/lib/client/format";
import { useUnits } from "@/lib/client/hooks";
import type { ActivityDetail } from "@/lib/client/types";

export function ActivityPage({ activity: a }: { activity: ActivityDetail }) {
  const router = useRouter();
  const units = useUnits();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      await del(`/activities/${a.id}`);
      toast.success("Post deleted");
      router.replace(`/u/${a.user.username}`);
    } catch (e) {
      toast.error(errorMessage(e));
      setDeleting(false);
    }
  }

  const setText = (s: NonNullable<ActivityDetail["exercises"]>[number]["sets"][number]) => {
    if (s.weight && s.reps) return `${formatWeight(s.weight, units)} × ${s.reps}`;
    if (s.reps) return `${s.reps} reps`;
    if (s.durationSeconds) return formatDuration(s.durationSeconds);
    if (s.distance) return `${trim(s.distance)} km`;
    return "–";
  };

  return (
    <div className="space-y-8">
      {a.status === "DRAFT" ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          <span>
            <Badge tone="warning">Draft</Badge> Only you can see this until you publish.
          </span>
          {a.workoutId ? <ButtonLink size="sm" href={`/workouts/${a.workoutId}/publish`}>Finish &amp; post</ButtonLink> : null}
        </div>
      ) : null}

      <ActivityCard activity={a} />

      {a.isOwner ? (
        <div className="flex flex-wrap gap-2">
          {a.workoutId ? (
            <ButtonLink variant="outline" href={`/workouts/${a.workoutId}/publish`}>
              <Pencil className="h-4 w-4" aria-hidden /> Edit post
            </ButtonLink>
          ) : null}
          <Button variant="danger" onClick={() => setConfirm(true)}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete post
          </Button>
        </div>
      ) : null}

      {a.exercises?.length ? (
        <section aria-labelledby="exercises-title">
          <SectionTitle>
            <span id="exercises-title">Exercises</span>
          </SectionTitle>
          <div className="space-y-3">
            {a.exercises.map((e) => (
              <Card as="section" key={e.exerciseId} className="p-4">
                <h3 className="display text-2xl">{e.name}</h3>
                <ol className="mt-1 divide-y divide-line text-sm">
                  {e.sets.map((s) => (
                    <li key={s.setNumber} className="flex justify-between py-2">
                      <span className="num w-10 text-subtle">{s.setType === "NORMAL" ? s.setNumber : s.setType[0]}</span>
                      <span className="num flex-1">{setText(s)}</span>
                      {s.rpe ? <span className="num text-xs text-subtle">RPE {s.rpe}</span> : null}
                    </li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>
        </section>
      ) : a.summary.length && !a.showExerciseDetails && !a.isOwner ? (
        <p className="text-center text-sm text-subtle">
          <Link href={`/u/${a.user.username}`} className="text-accent hover:underline">{a.user.displayName}</Link> keeps set details private.
        </p>
      ) : null}

      {a.status === "PUBLISHED" ? <Comments activityId={a.id} redirectTo={`/a/${a.shortId}`} /> : null}

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={remove} loading={deleting} danger title="Delete this post?" confirmLabel="Delete" message="Likes and comments are removed. Your logged workout stays in your history." />
    </div>
  );
}
