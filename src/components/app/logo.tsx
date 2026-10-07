import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/client/cn";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} aria-label="LIFTED home" className={cn("display inline-flex items-center gap-2 text-2xl", className)}>
      <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-[9px]" priority />
      <span>Lifted</span>
    </Link>
  );
}
