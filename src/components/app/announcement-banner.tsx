"use client";

import { Megaphone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/client/api";

type Site = { announcement: string | null };

export function AnnouncementBanner() {
  const q = useQuery({ queryKey: ["site"], queryFn: () => get<Site>("/site"), staleTime: 60_000 });
  const text = q.data?.announcement?.trim();
  if (!text) return null;
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm">
      <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
      <p className="min-w-0 flex-1">{text}</p>
    </div>
  );
}
