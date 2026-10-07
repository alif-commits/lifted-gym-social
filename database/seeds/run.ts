import { Pool } from "pg";
import { poolConfigFromUrl } from "../../src/server/db/connection";
import { EXERCISES } from "./exercises";
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
    console.log(`Seeded ${ex} exercises and ${fd} foods (${EXERCISES.length}/${FOODS.length} in catalog).`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
