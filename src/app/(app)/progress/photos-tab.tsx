"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { InfiniteList } from "@/components/app/infinite-list";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Field, Select, Textarea } from "@/components/ui/form";
import { ConfirmDialog, Dialog, toast } from "@/components/ui/overlay";
import { del, errorMessage, upload } from "@/lib/client/api";
import { longDate, titleCase } from "@/lib/client/format";
import { useList } from "@/lib/client/hooks";
import { PROGRESS_PHOTO_TYPES } from "@/lib/constants";

type Photo = { id: string; photoType: string; imageUrl: string; thumbnailUrl: string; recordedAt: string; notes: string | null };

export function PhotosTab() {
  const qc = useQueryClient();
  const list = useList<Photo>(["progress", "photos"], "/progress/photos", { limit: 24 });
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [toDelete, setToDelete] = useState<Photo | null>(null);
  const [type, setType] = useState<string>("FRONT");
  const [notes, setNotes] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["progress", "photos"] });

  const add = useMutation({
    mutationFn: (f: File) => {
      const form = new FormData();
      form.append("file", f);
      form.append("photoType", type);
      if (notes.trim()) form.append("notes", notes.trim());
      return upload("/progress/photos", form);
    },
    onSuccess: () => { setAdding(false); setNotes(""); refresh(); toast.success("Photo saved privately"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({ mutationFn: (id: string) => del(`/progress/photos/${id}`), onSuccess: () => { setToDelete(null); setViewing(null); refresh(); }, onError: (e) => toast.error(errorMessage(e)) });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted"><Lock className="h-4 w-4" aria-hidden /> Only you can see these. They never appear in feeds.</p>
        <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> Add photo</Button>
      </div>
      <InfiniteList
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        list={list}
        items={list.items}
        skeleton={<Skeleton className="aspect-[3/4]" />}
        empty={<EmptyState title="No progress photos" description="Add a front, side or back photo now and compare in a few weeks." action={<Button onClick={() => setAdding(true)}>Add first photo</Button>} />}
        render={(p) => (
          <button key={p.id} type="button" onClick={() => setViewing(p)} className="group relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-2 text-left">
            {/* eslint-disable-next-line @next/next/no-img-element -- authorised private media route */}
            <img src={p.thumbnailUrl} alt={`${titleCase(p.photoType)} photo from ${longDate(p.recordedAt)}`} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2 text-xs text-white">{longDate(p.recordedAt)}</span>
            <Badge className="absolute left-2 top-2">{titleCase(p.photoType)}</Badge>
          </button>
        )}
      />

      <Dialog open={adding} onClose={() => setAdding(false)} title="Add progress photo">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const f = file.current?.files?.[0]; if (f) add.mutate(f); }}>
          <Field label="Photo">{(p) => <input {...p} ref={file} type="file" accept="image/jpeg,image/png,image/webp" required className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-3 file:px-4 file:py-2 file:font-semibold file:text-fg" />}</Field>
          <Field label="View">{(p) => <Select {...p} value={type} onChange={(e) => setType(e.target.value)}>{PROGRESS_PHOTO_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select>}</Field>
          <Field label="Notes" optional>{(p) => <Textarea {...p} rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button><Button type="submit" loading={add.isPending}>Save</Button></div>
        </form>
      </Dialog>

      <Dialog open={viewing !== null} onClose={() => setViewing(null)} title={viewing ? `${titleCase(viewing.photoType)} · ${longDate(viewing.recordedAt)}` : "Photo"} className="max-w-2xl">
        {viewing ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- authorised private media route */}
            <img src={viewing.imageUrl} alt={`${titleCase(viewing.photoType)} progress photo`} className="mx-auto max-h-[60dvh] rounded-xl object-contain" />
            {viewing.notes ? <p className="text-sm text-muted">{viewing.notes}</p> : null}
            <Button variant="danger" size="sm" onClick={() => setToDelete(viewing)}><Trash2 className="h-4 w-4" aria-hidden /> Delete</Button>
          </div>
        ) : null}
      </Dialog>
      <ConfirmDialog open={toDelete !== null} onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove.mutate(toDelete.id)} loading={remove.isPending} danger title="Delete photo?" confirmLabel="Delete" message="The photo is permanently removed." />
    </div>
  );
}
