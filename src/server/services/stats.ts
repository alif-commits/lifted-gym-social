import { and, count, eq, isNotNull, sql } from "drizzle-orm";
import { toLocalDate } from "@/lib/tz";
import { getDb } from "@/server/db";
import { personalRecords, workouts } from "@/server/db/schema";
import { computeAchievements, weeklyStreak } from "@/lib/streak";

export type AthleteStats = {
  workouts: number;
  trainingSeconds: number;
  totalVolumeKg: number;
  prCount: number;
  streakWeeks: number;
};

export async function getAthleteStats(userId: string, timezone: string): Promise<AthleteStats> {
  const db = getDb();
  const [agg] = await db
    .select({
      workouts: count(),
      seconds: sql<number>`coalesce(sum(${workouts.durationSeconds}), 0)::float`,
      volume: sql<number>`coalesce(sum(${workouts.volume}), 0)::float`,
    })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "COMPLETED")));
  const [prs] = await db
    .select({ n: count() })
    .from(personalRecords)
    .where(and(eq(personalRecords.userId, userId), isNotNull(personalRecords.previousValue)));
  const dates = await db
    .select({ at: workouts.startedAt })
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.status, "COMPLETED")));
  const days = dates.map((d) => toLocalDate(d.at, timezone));
  return {
    workouts: agg?.workouts ?? 0,
    trainingSeconds: Number(agg?.seconds ?? 0),
    totalVolumeKg: Number(agg?.volume ?? 0),
    prCount: prs?.n ?? 0,
    streakWeeks: weeklyStreak(days, toLocalDate(new Date(), timezone)),
  };
}

export function achievementsFor(stats: AthleteStats) {
  return computeAchievements(stats);
}
