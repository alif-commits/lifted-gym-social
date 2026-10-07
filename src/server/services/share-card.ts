import { formatDuration } from "@/lib/client/format";
import { formatBestSet, formatShareVolume, type WorkoutShareView } from "@/lib/share-card";
import { config } from "@/server/config";
import { getActivityDetail } from "./activities";

export async function getWorkoutShareView(viewerId: string | null, idOrShort: string): Promise<WorkoutShareView> {
  const a = await getActivityDetail(viewerId, idOrShort);
  const highlights = a.summary.slice(0, 6).map((s) => ({
    name: s.name,
    sets: s.sets,
    detail: formatBestSet(s.best),
  }));
  const isPublic = a.status === "PUBLISHED" && a.visibility === "PUBLIC";
  return {
    shortId: a.shortId,
    title: a.title,
    displayName: a.user.displayName,
    username: a.user.username,
    dateLabel: a.startedAt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    duration: formatDuration(a.durationSeconds),
    volume: formatShareVolume(a.volume),
    setCount: a.setCount,
    exerciseCount: a.exerciseCount,
    repCount: a.repCount,
    prCount: a.prCount,
    highlights,
    publicUrl: `${config.appUrl}/a/${a.shortId}`,
    isPublic,
  };
}
