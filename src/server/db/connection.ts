import type { PoolConfig } from "pg";

/**
 * Build a `pg` pool config from a Postgres URL. Neon's `channel_binding` and `sslmode`
 * query params are translated into an explicit `ssl` option to keep behaviour stable
 * across `pg` versions.
 */
export function poolConfigFromUrl(rawUrl: string): PoolConfig {
  const url = new URL(rawUrl);
  const sslmode = url.searchParams.get("sslmode");
  url.searchParams.delete("channel_binding");
  url.searchParams.delete("sslmode");
  const isLocal = ["localhost", "127.0.0.1"].includes(url.hostname);
  const useSsl = !isLocal && sslmode !== "disable";
  return {
    connectionString: url.toString(),
    ssl: useSsl ? { rejectUnauthorized: true } : undefined,
  };
}
