"use client";

import { useQuery } from "@tanstack/react-query";
import { Camera, ImageUp, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { NutritionNav } from "@/components/app/nutrition-nav";
import { PageHeader } from "@/components/app/page-header";
import { Badge, Card, SectionTitle } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/overlay";
import { ApiClientError, errorMessage, get, upload } from "@/lib/client/api";
import { timeAgo } from "@/lib/client/format";
import { MAX_IMAGE_BYTES } from "@/lib/constants";

type ScanListItem = { id: string; status: string; imageUrl: string | null; createdAt: string };
const TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = { CONFIRMED: "success", COMPLETED: "warning", FAILED: "danger", PROCESSING: "neutral", CANCELLED: "neutral" };
const LABEL: Record<string, string> = { CONFIRMED: "Logged", COMPLETED: "Review", FAILED: "Failed", PROCESSING: "Analysing", CANCELLED: "Cancelled" };

export function ScanUpload() {
  const router = useRouter();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const recent = useQuery({ queryKey: ["scans"], queryFn: () => get<ScanListItem[]>("/food-scans") });

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choose(f: File | undefined) {
    if (!f) return;
    if (f.size > MAX_IMAGE_BYTES) return toast.error("That photo is over 8 MB. Pick a smaller one.");
    if (f.type && !/^image\/(jpeg|png|webp)$/.test(f.type)) return toast.error("Use a JPEG, PNG or WebP photo.");
    setFile(f);
  }

  async function analyse() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const scan = await upload<{ id: string }>("/food-scans", form);
      router.push(`/nutrition/scan/${scan.id}`);
    } catch (e) {
      toast.error(e instanceof ApiClientError && e.status === 429 ? "You've hit the scan limit for now. Try again later." : errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Scan a meal" subtitle="Photograph your plate. You review everything before it's logged." />
      <NutritionNav />
      <Card className="overflow-hidden">
        {preview ? (
          <div className="relative bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img src={preview} alt="Selected meal" className="mx-auto max-h-[420px] w-full object-contain" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 bg-surface-2 px-6 py-14 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Camera className="h-8 w-8" aria-hidden /></span>
            <p className="font-semibold">Take or choose a photo of your meal</p>
            <p className="max-w-sm text-sm text-muted">Good light, plate fully in frame, one meal at a time. JPEG, PNG or WebP up to 8 MB.</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 p-4">
          <Button variant={file ? "secondary" : "primary"} onClick={() => camera.current?.click()}><Camera className="h-4 w-4" aria-hidden /> Camera</Button>
          <Button variant="secondary" onClick={() => gallery.current?.click()}><ImageUp className="h-4 w-4" aria-hidden /> Upload</Button>
          {file ? <Button className="ml-auto" loading={busy} onClick={analyse}><Sparkles className="h-4 w-4" aria-hidden /> Analyse meal</Button> : null}
        </div>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
      </Card>
      <p className="mt-3 flex items-start gap-2 text-xs text-subtle">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> Estimates come from AI and can be wrong. Photos are private to you and used only for this scan.
      </p>

      {recent.data?.length ? (
        <section className="mt-8">
          <SectionTitle>Recent scans</SectionTitle>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {recent.data.slice(0, 8).map((s) => (
              <li key={s.id}>
                <Link href={`/nutrition/scan/${s.id}`} className="group relative block aspect-square overflow-hidden rounded-xl bg-surface-2">
                  {s.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- authorised media route
                    <img src={s.imageUrl} alt={`Scan from ${timeAgo(s.createdAt)}`} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : null}
                  <Badge tone={TONE[s.status] ?? "neutral"} className="absolute bottom-1.5 left-1.5">{LABEL[s.status] ?? s.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
