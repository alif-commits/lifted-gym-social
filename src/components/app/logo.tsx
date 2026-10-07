import Link from "next/link";
import { cn } from "@/lib/client/cn";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} aria-label="LIFTED home" className={cn("display inline-flex items-center gap-2 text-2xl", className)}>
      <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-lg text-accent-fg">
        L
      </span>
      <span>Lifted</span>
    </Link>
  );
}
