import Link from "next/link";
import { cn } from "@/lib/client/cn";

type Photo = { id: string; url: string; thumbUrl: string; width: number; height: number };

/** 1 photo: full width; 2+: a tidy mosaic with a "+N" overflow tile. Always links to the activity. */
export function PhotoGrid({ photos, href, className }: { photos: Photo[]; href: string; className?: string }) {
  const shown = photos.slice(0, 4);
  const extra = photos.length - shown.length;
  if (shown.length === 1) {
    const p = shown[0];
    return (
      <Link href={href} className={cn("block overflow-hidden bg-surface-2", className)} aria-label="Open activity photos">
        {/* eslint-disable-next-line @next/next/no-img-element -- authorised media route */}
        <img src={p.url} alt="Workout photo" width={p.width} height={p.height} loading="lazy" className="max-h-[520px] w-full object-cover" style={{ aspectRatio: `${Math.max(0.8, Math.min(p.width / p.height, 1.91))}` }} />
      </Link>
    );
  }
  return (
    <Link href={href} className={cn("grid grid-cols-2 gap-0.5 overflow-hidden", className)} aria-label="Open activity photos">
      {shown.map((p, i) => (
        <span key={p.id} className="relative aspect-square bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- authorised media route */}
          <img src={p.thumbUrl} alt={`Workout photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
          {i === 3 && extra > 0 ? <span className="absolute inset-0 flex items-center justify-center bg-black/55 display text-4xl text-white">+{extra}</span> : null}
        </span>
      ))}
    </Link>
  );
}
