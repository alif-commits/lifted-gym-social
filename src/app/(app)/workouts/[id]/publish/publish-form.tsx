"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Globe, ImagePlus, Lock, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ActivityCard } from "@/components/app/activity-card";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, ErrorState, SectionTitle, Skeleton } from "@/components/ui/feedback";
import { Field, Input, Segmented, Switch, Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/overlay";
import { del, errorMessage, patch, post, put, upload } from "@/lib/client/api";
import type { ActivityCard as Card_ } from "@/lib/client/types";
import { MAX_ACTIVITY_PHOTOS } from "@/lib/constants";

type Photo = Card_["photos"][number];

/** Create-or-edit the social post for a finished workout. Photos upload immediately; text saves on publish. */
export function PublishForm({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const draft = useQuery({ queryKey: ["activity-draft", workoutId], queryFn: () => post<Card_>("/activities", { workoutId }), staleTime: Infinity, refetchOnWindowFocus: false });

  if (draft.isLoading) return <Skeleton className="h-96" />;
  if (draft.isError) return <ErrorState message={draft.error.message} onRetry={() => draft.refetch()} />;
  return <Editor key={draft.data!.id} activity={draft.data!} workoutId={workoutId} onDone={(a) => { qc.invalidateQueries({ queryKey: ["feed"] }); qc.invalidateQueries({ queryKey: ["workouts"] }); router.replace(`/a/${a.shortId}`); }} />;
}

function Editor({ activity, workoutId, onDone }: { activity: Card_; workoutId: string; onDone: (a: Card_) => void }) {
  const router = useRouter();
  const published = activity.status === "PUBLISHED";
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description ?? "");
  const [visibility, setVisibility] = useState(activity.visibility);
  const [showDetails, setShowDetails] = useState(activity.showExerciseDetails);
  const [location, setLocation] = useState(activity.locationName ?? "");
  const [photos, setPhotos] = useState<Photo[]>(activity.photos);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState<"publish" | "draft" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_ACTIVITY_PHOTOS - photos.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > chosen.length) toast.info(`Up to ${MAX_ACTIVITY_PHOTOS} photos per post`);
    for (const file of chosen) {
      setUploading((n) => n + 1);
      try {
        const form = new FormData();
        form.append("file", file);
        const photo = await upload<Photo>(`/activities/${activity.id}/photos`, form);
        setPhotos((p) => [...p, photo]);
      } catch (e) {
        toast.error(`${file.name}: ${errorMessage(e)}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function removePhoto(id: string) {
    try {
      await del(`/activities/${activity.id}/photos/${id}`);
      setPhotos((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...photos];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setPhotos(next);
    try {
      await put(`/activities/${activity.id}/photos/order`, { photoIds: next.map((p) => p.id) });
    } catch (e) {
      setPhotos(photos);
      toast.error(errorMessage(e));
    }
  }

  async function save(mode: "publish" | "draft") {
    setSaving(mode);
    try {
      const card = await patch<Card_>(`/activities/${activity.id}`, { title: title.trim() || activity.title, description: description.trim() || null, visibility, showExerciseDetails: showDetails, locationName: location.trim() || null });
      if (mode === "publish") {
        const done = published ? card : await post<Card_>(`/activities/${activity.id}/publish`);
        toast.success(published ? "Changes saved" : "Posted to your feed");
        onDone(done);
      } else {
        toast.success("Draft saved");
        router.replace(`/workouts/${workoutId}`);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <PageHeader title={published ? "Edit post" : "Share workout"} subtitle="Add photos and choose who sees it." />
      <div className="space-y-6">
        <Card className="space-y-4 p-5">
          <Field label="Title">{(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />}</Field>
          <Field label="Caption" optional hint="Use #hashtags and @mentions.">
            {(p) => <Textarea {...p} rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          <Field label="Location" optional>
            {(p) => <Input {...p} value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} placeholder="Gym or city" />}
          </Field>
        </Card>

        <section>
          <SectionTitle>
            Photos <span className="num text-base text-subtle">{photos.length}/{MAX_ACTIVITY_PHOTOS}</span>
          </SectionTitle>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p, i) => (
              <li key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- authorised media route */}
                <img src={p.thumbUrl} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-1.5">
                  <div className="flex gap-1">
                    <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white disabled:opacity-30">
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </button>
                    <button type="button" aria-label="Move later" disabled={i === photos.length - 1} onClick={() => move(i, 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white disabled:opacity-30">
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                  <button type="button" aria-label="Remove photo" onClick={() => removePhoto(p.id)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/50 text-white hover:bg-danger">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
            {Array.from({ length: uploading }, (_, i) => (
              <li key={`u${i}`} className="skeleton aspect-square rounded-xl" aria-label="Uploading" />
            ))}
            {photos.length + uploading < MAX_ACTIVITY_PHOTOS ? (
              <li>
                <button type="button" onClick={() => fileRef.current?.click()} className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-sm text-muted hover:border-accent hover:text-accent">
                  <ImagePlus className="h-6 w-6" aria-hidden /> Add photos
                </button>
              </li>
            ) : null}
          </ul>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        </section>

        <Card className="space-y-5 p-5">
          <div>
            <p className="mb-2 text-sm font-medium">Who can see this?</p>
            <Segmented
              label="Visibility"
              value={visibility}
              onChange={setVisibility}
              options={[
                { value: "PUBLIC", label: <span className="flex items-center gap-1.5"><Globe className="h-4 w-4" aria-hidden />Public</span> },
                { value: "FOLLOWERS", label: <span className="flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden />Followers</span> },
                { value: "PRIVATE", label: <span className="flex items-center gap-1.5"><Lock className="h-4 w-4" aria-hidden />Only me</span> },
              ]}
            />
          </div>
          <Switch checked={showDetails} onChange={setShowDetails} label="Show exercise details" description="Viewers see every exercise and set. Off shows only the summary stats." />
        </Card>

        <section>
          <SectionTitle>Preview</SectionTitle>
          <ActivityCard activity={{ ...activity, title: title || activity.title, description: description || null, visibility, photos, showExerciseDetails: showDetails }} />
        </section>

        <div className="sticky bottom-20 z-10 flex gap-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-card backdrop-blur lg:bottom-4">
          {!published ? (
            <Button variant="secondary" onClick={() => save("draft")} loading={saving === "draft"} disabled={saving !== null}>
              Save draft
            </Button>
          ) : null}
          <Button className="flex-1" onClick={() => save("publish")} loading={saving === "publish"} disabled={saving !== null || uploading > 0}>
            {published ? "Save changes" : "Post to feed"}
          </Button>
        </div>
      </div>
    </>
  );
}
