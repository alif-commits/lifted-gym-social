import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { rateLimited } from "@/server/http/errors";

export type RateLimitRule = { key: string; limit: number; windowSeconds: number };

/**
 * Fixed-window rate limiter backed by Postgres (no extra infrastructure).
 * Throws a 429 ApiError when the limit is exceeded.
 */
export async function enforceRateLimit(rule: RateLimitRule): Promise<void> {
  const windowMs = rule.windowSeconds * 1000;
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const result = await getDb().execute<{ count: number }>(sql`
    insert into rate_limits (key, window_start, count)
    values (${rule.key}, ${windowStart.toISOString()}::timestamptz, 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count
  `);
  const count = Number(result.rows[0]?.count ?? 1);
  if (count > rule.limit) {
    const retryAfter = (windowStart.getTime() + windowMs - now) / 1000;
    throw rateLimited(retryAfter);
  }
}

export async function purgeExpiredRateLimits() {
  await getDb().execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
}
