"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/client/cn";

const LINKS = [
  { href: "/nutrition", label: "Today", exact: true },
  { href: "/nutrition/scan", label: "Scan meal" },
  { href: "/nutrition/history", label: "History" },
  { href: "/nutrition/calculator", label: "Calculator" },
];

export function NutritionNav() {
  const path = usePathname();
  return (
    <nav aria-label="Nutrition" className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {LINKS.map((l) => {
        const active = l.exact ? path === l.href || path === "/nutrition/add" : path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={cn("relative flex min-h-11 shrink-0 items-center px-4 text-sm font-semibold", active ? "text-fg" : "text-subtle hover:text-fg")}>
            {l.label}
            {active ? <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
