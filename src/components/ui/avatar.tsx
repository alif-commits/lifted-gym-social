import { cn } from "@/lib/client/cn";

const sizes = { xs: "h-6 w-6 text-[10px]", sm: "h-9 w-9 text-xs", md: "h-11 w-11 text-sm", lg: "h-16 w-16 text-lg", xl: "h-28 w-28 text-3xl" };

export function Avatar({ name, src, size = "md", className }: { name: string; src?: string | null; size?: keyof typeof sizes; className?: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-3 font-bold text-muted ring-1 ring-line", sizes[size], className)} aria-hidden={!src ? undefined : true}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- authorised media route; sizes are tiny and already optimised
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </span>
  );
}
