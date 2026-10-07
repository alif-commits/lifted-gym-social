import { formatDuration, round, trim } from "@/lib/client/format";

export type ShareBestSet = {
  weight: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distance: number | null;
};

export type ShareHighlight = { name: string; detail: string; sets: number };

export type WorkoutShareView = {
  shortId: string;
  title: string;
  displayName: string;
  username: string;
  dateLabel: string;
  duration: string;
  volume: string;
  setCount: number;
  exerciseCount: number;
  repCount: number;
  prCount: number;
  highlights: ShareHighlight[];
  publicUrl: string;
  isPublic: boolean;
};

/** Best-set line for share cards. Weights are stored in kg. */
export function formatBestSet(best: ShareBestSet): string {
  if (best.weight != null && best.reps != null) return `${trim(round(best.weight, 1))} kg × ${best.reps}`;
  if (best.reps != null) return `${best.reps} reps`;
  if (best.distance != null) return `${trim(round(best.distance, 2))} km`;
  if (best.durationSeconds != null) return formatDuration(best.durationSeconds);
  return "–";
}

export function formatShareVolume(kg: number | null | undefined): string {
  if (kg == null) return "–";
  return kg >= 10_000 ? `${trim(round(kg / 1000, 1))}k kg` : `${Math.round(kg).toLocaleString()} kg`;
}

export const SHARE_OG_SIZE = { width: 1200, height: 630 } as const;
export const SHARE_STORY_SIZE = { width: 1080, height: 1350 } as const;
