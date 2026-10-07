import { and, eq, sql } from "drizzle-orm";
import type { SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { personalRecords, userSettings, users, workouts } from "@/server/db/schema";
import { userSummary } from "./dto";

export const LEADERBOARD_METRICS = ["workouts", "time", "volume", "prs", "days"] as const;
export type LeaderboardMetric = (typeof LEADERBOARD_METRICS)[number];
export const LEADERBOARD_WINDOWS = ["week", "month", "all"] as const;
export type LeaderboardWindow = (typeof LEADERBOARD_WINDOWS)[number];

function windowStart(window: LeaderboardWindow, now = new Date()) {
  if (window === "all") return null;
  const d = new Date(now);
  if (window === "week") {
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day);
  } else {
    d.setUTCDate(1);
  }
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Friends leaderboard: you + people you follow, minus blocks, only active accounts. */
export async function friendsLeaderboard(me: SessionUser, metric: LeaderboardMetric, window: LeaderboardWindow) {
  const db = getDb();
  const since = windowStart(window);
  const sinceSql = since ? sql`and ${workouts.completedAt} >= ${since}` : sql``;
  const valueSql = {
    workouts: sql<number>`count(${workouts.id})::int`,
    time: sql<number>`coalesce(sum(${workouts.durationSeconds}), 0)::int`,
    volume: sql<number>`coalesce(sum(${workouts.volume}), 0)::float`,
    prs: sql<number>`coalesce(sum(${workouts.prCount}), 0)::int`,
    days: sql<number>`count(distinct date_trunc('day', ${workouts.completedAt} at time zone 'utc'))::int`,
  }[metric];

  const rows = await db
    .select({
      u: users,
      value: valueSql,
    })
    .from(users)
    .innerJoin(userSettings, eq(userSettings.userId, users.id))
    .leftJoin(
      workouts,
      sql`${workouts.userId} = ${users.id} and ${workouts.status} = 'COMPLETED' ${sinceSql}`,
    )
    .where(
      and(
        eq(users.status, "active"),
        sql`(${users.id} = ${me.id}::uuid or exists (select 1 from follows f where f.follower_id = ${me.id}::uuid and f.followed_id = ${users.id}))`,
        sql`not exists (select 1 from blocks b where (b.blocker_id = ${me.id}::uuid and b.blocked_id = ${users.id}) or (b.blocker_id = ${users.id} and b.blocked_id = ${me.id}::uuid))`,
      ),
    )
    .groupBy(users.id)
    .orderBy(sql`${valueSql} desc`, users.username);

  const extraPrs =
    metric === "prs"
      ? await db
          .select({ userId: personalRecords.userId, n: sql<number>`count(*)::int` })
          .from(personalRecords)
          .where(since ? sql`${personalRecords.achievedAt} >= ${since}` : sql`true`)
          .groupBy(personalRecords.userId)
      : [];
  const prMap = new Map(extraPrs.map((r) => [r.userId, r.n]));

  return rows.map((r, i) => ({
    rank: i + 1,
    user: userSummary(r.u),
    value: metric === "prs" ? (prMap.get(r.u.id) ?? 0) : r.value,
    isMe: r.u.id === me.id,
  }));
}
