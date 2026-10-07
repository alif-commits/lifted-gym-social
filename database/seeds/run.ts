import { Pool } from "pg";
import { poolConfigFromUrl } from "../../src/server/db/connection";
import { EXERCISES } from "./exercises";
import { EXERCISE_GUIDES } from "./exercise-guides";
import { FOODS } from "./foods";

const TYPE_BY_MODE = { WEIGHT_REPS: "STRENGTH", BODYWEIGHT_REPS: "BODYWEIGHT", DURATION: "TIMED", DISTANCE_DURATION: "CARDIO" } as const;

/** Idempotent: inserts only global rows whose name does not exist yet. */
async function main() {
  const pool = new Pool({ ...poolConfigFromUrl(process.env.DATABASE_URL!), max: 1 });
  try {
    const existingEx = new Set((await pool.query("select lower(name) n from exercises where is_global = true")).rows.map((r) => r.n));
    let ex = 0;
    for (const [name, primary, equipment, mode, secondary, difficulty] of EXERCISES) {
      if (existingEx.has(name.toLowerCase())) continue;
      await pool.query(
        `insert into exercises (name, primary_muscle_group, secondary_muscles, equipment, exercise_type, tracking_mode, difficulty, is_global, active)
         values ($1,$2,$3::jsonb,$4,$5,$6,$7,true,true)`,
        [name, primary, JSON.stringify(secondary), equipment, TYPE_BY_MODE[mode], mode, difficulty],
      );
      ex++;
    }

    const existingFood = new Set((await pool.query("select lower(name) n from food_items where is_global = true")).rows.map((r) => r.n));
    let fd = 0;
    for (const [name, size, unit, kcal, p, c, f, fiber] of FOODS) {
      if (existingFood.has(name.toLowerCase())) continue;
      await pool.query(
        `insert into food_items (name, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, source, verified, is_global)
         values ($1,$2,$3,$4,$5,$6,$7,$8,'SEED',true,true)`,
        [name, size, unit, kcal, p, c, f, fiber],
      );
      fd++;
    }
    let guides = 0;
    for (const [name, g] of Object.entries(EXERCISE_GUIDES)) {
      const res = await pool.query(
        `update exercises
            set setup_instructions = $2,
                execution_steps = $3::jsonb,
                breathing_notes = $4,
                common_mistakes = $5::jsonb
          where is_global = true and lower(name) = lower($1)`,
        [name, g.setup ?? null, JSON.stringify(g.steps), g.breathing ?? null, JSON.stringify(g.mistakes)],
      );
      if (res.rowCount) guides++;
      if (g.media) {
        await pool.query(
          `delete from exercise_media
            where provider = $2
              and exercise_id in (select id from exercises where is_global = true and lower(name) = lower($1))`,
          [name, g.media.provider],
        );
        await pool.query(
          `insert into exercise_media (exercise_id, provider, media_type, source_url, license, attribution)
           select id, $2, $3, $4, $5, $6 from exercises
            where is_global = true and lower(name) = lower($1)`,
          [name, g.media.provider, g.media.mediaType, g.media.sourceUrl, g.media.license, g.media.attribution],
        );
      }
    }

    const bootstrap = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    if (bootstrap) {
      const promoted = await pool.query("update users set role = 'admin' where lower(email) = $1 and status <> 'deleted' and role <> 'admin' returning email", [bootstrap]);
      if (promoted.rowCount) console.log(`Granted admin to ${bootstrap}.`);
    }

    console.log(`Seeded ${ex} exercises and ${fd} foods (${EXERCISES.length}/${FOODS.length} in catalog). Updated ${guides} movement guides.`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
