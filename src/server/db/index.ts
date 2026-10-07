import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { poolConfigFromUrl } from "./connection";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Either the root db or a transaction; services accept both. */
export type DbOrTx = Db | Tx;

const globalForDb = globalThis as unknown as { __liftedPool?: Pool; __liftedDb?: Db; __liftedSchema?: typeof schema };

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({
    ...poolConfigFromUrl(url),
    max: process.env.NODE_ENV === "production" ? 5 : 3,
    // Serverless Postgres poolers drop idle sockets; recycle early and keep live ones warm.
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    // A hung socket must fail fast instead of stalling a request for minutes.
    statement_timeout: 20_000,
    query_timeout: 25_000,
  });
  // An error on an idle client must not crash the process; the pool discards that client.
  pool.on("error", (err) => console.error(`[db] idle client error: ${err.message}`));
  return pool;
}

/** Lazily initialised so `next build` does not require DATABASE_URL. */
export function getDb(): Db {
  if (!globalForDb.__liftedPool) globalForDb.__liftedPool = createPool();
  // Rebuild when the schema module is replaced (next dev HMR), so new tables are queryable.
  if (!globalForDb.__liftedDb || globalForDb.__liftedSchema !== schema) {
    globalForDb.__liftedSchema = schema;
    globalForDb.__liftedDb = drizzle(globalForDb.__liftedPool, { schema });
  }
  return globalForDb.__liftedDb;
}

export async function pingDb() {
  const { sql } = await import("drizzle-orm");
  await getDb().execute(sql`select 1`);
}

export { schema };
