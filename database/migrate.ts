import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { poolConfigFromUrl } from "../src/server/db/connection";

async function main() {
  const pool = new Pool({ ...poolConfigFromUrl(process.env.DATABASE_URL!), max: 1 });
  await migrate(drizzle(pool), { migrationsFolder: "./database/migrations" });
  await pool.end();
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
