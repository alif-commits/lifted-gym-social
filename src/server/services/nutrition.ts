import { and, asc, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import { calculateCalories, type CalorieInput } from "@/lib/calc/calories";
import { compareToGoal, scaleFood, sumMacros, type GoalTargets, type Macros } from "@/lib/calc/nutrition";
import { addDaysToDateString, localDayRange, toLocalDate } from "@/lib/tz";
import type { calorieGoalSchema, EntryInput, foodInputSchema } from "@/lib/validators/nutrition";
import type { z } from "zod";
import type { SessionUser } from "@/server/auth/session";
import { getDb, type DbOrTx } from "@/server/db";
import { calorieCalculations, calorieGoals, foodItems, meals, nutritionEntries, nutritionShareCards } from "@/server/db/schema";
import { badRequest, forbidden, notFound } from "@/server/http/errors";
import { shortId } from "@/server/lib/ids";

type Goal = typeof calorieGoals.$inferSelect;
type Food = typeof foodItems.$inferSelect;
type Entry = typeof nutritionEntries.$inferSelect;

/* ---------------------------------- Calculator ------------------------------ */

export async function calculateAndMaybeSave(user: SessionUser, input: CalorieInput & { save: boolean }) {
  const result = calculateCalories(input);
  if (input.save) {
    await getDb().transaction(async (tx) => {
      await tx.insert(calorieCalculations).values({
        userId: user.id,
        formula: result.formula,
        age: input.age,
        sex: input.sex,
        heightCm: input.heightCm,
        weightKg: input.weightKg,
        activityLevel: input.activityLevel,
        bmr: result.bmr,
        tdee: result.tdee,
        goal: input.goal,
        adjustment: result.settings.adjustmentKcal,
        targetCalories: result.targetCalories,
      });
      await replaceGoal(tx, user, {
        calorieTarget: result.targetCalories,
        proteinTargetG: result.macros.proteinG,
        carbsTargetG: result.macros.carbsG,
        fatTargetG: result.macros.fatG,
        fiberTargetG: result.macros.fiberG,
        source: "CALCULATOR",
      });
    });
  }
  return result;
}

/* ------------------------------------ Goals --------------------------------- */

export const goalDto = (g: Goal | undefined | null) =>
  g
    ? {
        id: g.id,
        calorieTarget: g.calorieTarget,
        proteinTargetG: g.proteinTargetG,
        carbsTargetG: g.carbsTargetG,
        fatTargetG: g.fatTargetG,
        fiberTargetG: g.fiberTargetG,
        source: g.source,
        startDate: g.startDate,
      }
    : null;

export async function getActiveGoal(userId: string, db: DbOrTx = getDb()) {
  const [g] = await db.select().from(calorieGoals).where(and(eq(calorieGoals.userId, userId), eq(calorieGoals.active, true))).limit(1);
  return g ?? null;
}

async function replaceGoal(tx: DbOrTx, user: SessionUser, input: z.infer<typeof calorieGoalSchema>) {
  const today = toLocalDate(new Date(), user.settings.timezone);
  await tx.update(calorieGoals).set({ active: false, endDate: today }).where(and(eq(calorieGoals.userId, user.id), eq(calorieGoals.active, true)));
  const [g] = await tx
    .insert(calorieGoals)
    .values({
      userId: user.id,
      calorieTarget: input.calorieTarget,
      proteinTargetG: input.proteinTargetG,
      carbsTargetG: input.carbsTargetG,
      fatTargetG: input.fatTargetG,
      fiberTargetG: input.fiberTargetG ?? null,
      source: input.source,
      startDate: today,
    })
    .returning();
  return g;
}

export async function setGoal(user: SessionUser, input: z.infer<typeof calorieGoalSchema>) {
  return goalDto(await getDb().transaction((tx) => replaceGoal(tx, user, input)));
}

export const goalTargets = (g: Goal | null): GoalTargets | null =>
  g ? { calories: g.calorieTarget, proteinG: g.proteinTargetG, carbsG: g.carbsTargetG, fatG: g.fatTargetG, fiberG: g.fiberTargetG } : null;

/* ------------------------------------ Foods --------------------------------- */

export const foodDto = (f: Food, viewerId: string) => ({
  id: f.id,
  name: f.name,
  brand: f.brand,
  servingSize: f.servingSize,
  servingUnit: f.servingUnit,
  calories: f.calories,
  proteinG: f.proteinG,
  carbsG: f.carbsG,
  fatG: f.fatG,
  fiberG: f.fiberG,
  barcode: f.barcode,
  verified: f.verified,
  isOwn: f.ownerUserId === viewerId,
});

const escapeLike = (s: string) => s.replace(/[%_\\]/g, "\\$&");

export async function searchFoods(user: SessionUser, q: string, limit: number) {
  const rows = await getDb()
    .select()
    .from(foodItems)
    .where(and(or(eq(foodItems.isGlobal, true), eq(foodItems.ownerUserId, user.id)), or(ilike(foodItems.name, `%${escapeLike(q)}%`), ilike(foodItems.brand, `%${escapeLike(q)}%`))))
    .orderBy(
      // own foods first, then prefix matches, then shorter (more generic) names
      sql`(${foodItems.ownerUserId} is not null) desc`,
      sql`(${foodItems.name} ilike ${escapeLike(q) + "%"}) desc`,
      sql`length(${foodItems.name})`,
      foodItems.name,
    )
    .limit(limit);
  return rows.map((f) => foodDto(f, user.id));
}

export async function recentFoods(user: SessionUser, limit = 12) {
  const rows = await getDb()
    .select({ f: foodItems, last: sql<Date>`max(${nutritionEntries.consumedAt})` })
    .from(nutritionEntries)
    .innerJoin(foodItems, eq(foodItems.id, nutritionEntries.foodItemId))
    .where(eq(nutritionEntries.userId, user.id))
    .groupBy(foodItems.id)
    .orderBy(desc(sql`max(${nutritionEntries.consumedAt})`))
    .limit(limit);
  return rows.map((r) => foodDto(r.f, user.id));
}

export async function createFood(user: SessionUser, input: z.infer<typeof foodInputSchema>) {
  const [f] = await getDb()
    .insert(foodItems)
    .values({ ...input, brand: input.brand ?? null, fiberG: input.fiberG ?? null, barcode: input.barcode ?? null, ownerUserId: user.id, source: "USER" })
    .returning();
  return foodDto(f, user.id);
}

async function ownFood(user: SessionUser, id: string) {
  const [f] = await getDb().select().from(foodItems).where(eq(foodItems.id, id)).limit(1);
  if (!f || (!f.isGlobal && f.ownerUserId !== user.id)) throw notFound("Food");
  if (f.ownerUserId !== user.id) throw forbidden("Built-in foods can't be edited");
  return f;
}

export async function updateFood(user: SessionUser, id: string, input: z.infer<typeof foodInputSchema>) {
  await ownFood(user, id);
  const [f] = await getDb()
    .update(foodItems)
    .set({ ...input, brand: input.brand ?? null, fiberG: input.fiberG ?? null, barcode: input.barcode ?? null })
    .where(eq(foodItems.id, id))
    .returning();
  return foodDto(f, user.id);
}

export async function deleteFood(user: SessionUser, id: string) {
  await ownFood(user, id);
  await getDb().delete(foodItems).where(eq(foodItems.id, id));
}

export async function getAccessibleFood(userId: string, id: string, db: DbOrTx = getDb()) {
  const [f] = await db.select().from(foodItems).where(and(eq(foodItems.id, id), or(eq(foodItems.isGlobal, true), eq(foodItems.ownerUserId, userId)))).limit(1);
  return f ?? null;
}

/* ----------------------------------- Entries -------------------------------- */

export const entryDto = (e: Entry, mealName: string | null) => ({
  id: e.id,
  mealName: mealName ?? "Other",
  foodItemId: e.foodItemId,
  source: e.source,
  foodName: e.foodName,
  quantity: e.quantity,
  unit: e.unit,
  calories: e.calories,
  proteinG: e.proteinG,
  carbsG: e.carbsG,
  fatG: e.fatG,
  fiberG: e.fiberG,
  consumedAt: e.consumedAt,
  confidenceScore: e.confidenceScore,
  notes: e.notes,
});

/** Group entries into one meal per (user, name, local day) so a day reads as Breakfast/Lunch/... */
export async function findOrCreateMeal(tx: DbOrTx, user: SessionUser, name: string, consumedAt: Date) {
  const day = toLocalDate(consumedAt, user.settings.timezone);
  const { start, end } = localDayRange(day, user.settings.timezone);
  const [existing] = await tx
    .select({ id: meals.id })
    .from(meals)
    .where(and(eq(meals.userId, user.id), sql`lower(${meals.name}) = lower(${name})`, gte(meals.consumedAt, start), lt(meals.consumedAt, end)))
    .limit(1);
  if (existing) return existing.id;
  const [m] = await tx.insert(meals).values({ userId: user.id, name, consumedAt }).returning({ id: meals.id });
  return m.id;
}

async function resolveMacros(userId: string, input: Pick<EntryInput, "foodItemId" | "quantity" | "unit" | "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG">): Promise<Macros> {
  if (input.foodItemId) {
    const food = await getAccessibleFood(userId, input.foodItemId);
    if (!food) throw notFound("Food");
    const scaled = scaleFood(food, input.quantity, input.unit);
    if (!scaled) throw badRequest(`Can't convert ${input.unit} to ${food.servingUnit} for this food`, "INCOMPATIBLE_UNIT");
    return scaled;
  }
  return { calories: input.calories, proteinG: input.proteinG, carbsG: input.carbsG, fatG: input.fatG, fiberG: input.fiberG ?? 0 };
}

export async function createEntry(user: SessionUser, input: EntryInput) {
  const macros = await resolveMacros(user.id, input);
  const consumedAt = input.consumedAt ? new Date(input.consumedAt) : new Date();
  return getDb().transaction(async (tx) => {
    const mealId = await findOrCreateMeal(tx, user, input.mealName, consumedAt);
    const [e] = await tx
      .insert(nutritionEntries)
      .values({
        userId: user.id,
        mealId,
        foodItemId: input.foodItemId ?? null,
        source: input.foodItemId ? "SEARCH" : "MANUAL",
        foodName: input.foodName,
        quantity: input.quantity,
        unit: input.unit,
        ...macros,
        consumedAt,
        notes: input.notes,
      })
      .returning();
    return entryDto(e, input.mealName);
  });
}

export async function updateEntry(user: SessionUser, id: string, patch: Partial<EntryInput>) {
  const db = getDb();
  const [cur] = await db.select().from(nutritionEntries).where(and(eq(nutritionEntries.id, id), eq(nutritionEntries.userId, user.id))).limit(1);
  if (!cur) throw notFound("Entry");
  const merged = {
    foodItemId: patch.foodItemId === undefined ? cur.foodItemId : patch.foodItemId,
    quantity: patch.quantity ?? cur.quantity,
    unit: patch.unit ?? cur.unit,
    calories: patch.calories ?? cur.calories,
    proteinG: patch.proteinG ?? cur.proteinG,
    carbsG: patch.carbsG ?? cur.carbsG,
    fatG: patch.fatG ?? cur.fatG,
    fiberG: patch.fiberG === undefined ? cur.fiberG : patch.fiberG,
  };
  // Re-scale from the linked food only when the quantity/unit changed and no explicit macros were sent.
  const macrosSent = ["calories", "proteinG", "carbsG", "fatG"].some((k) => k in patch);
  const macros = merged.foodItemId && !macrosSent && (patch.quantity !== undefined || patch.unit !== undefined) ? await resolveMacros(user.id, merged as EntryInput) : { calories: merged.calories, proteinG: merged.proteinG, carbsG: merged.carbsG, fatG: merged.fatG, fiberG: merged.fiberG ?? 0 };
  const consumedAt = patch.consumedAt ? new Date(patch.consumedAt) : cur.consumedAt;
  return db.transaction(async (tx) => {
    const mealId = patch.mealName || patch.consumedAt ? await findOrCreateMeal(tx, user, patch.mealName ?? (await mealNameOf(tx, cur.mealId)) ?? "Other", consumedAt) : cur.mealId;
    const [e] = await tx
      .update(nutritionEntries)
      .set({ mealId, foodName: patch.foodName ?? cur.foodName, quantity: merged.quantity, unit: merged.unit, ...macros, consumedAt, notes: patch.notes === undefined ? cur.notes : patch.notes })
      .where(eq(nutritionEntries.id, id))
      .returning();
    return entryDto(e, await mealNameOf(tx, e.mealId));
  });
}

async function mealNameOf(tx: DbOrTx, mealId: string | null) {
  if (!mealId) return null;
  const [m] = await tx.select({ name: meals.name }).from(meals).where(eq(meals.id, mealId)).limit(1);
  return m?.name ?? null;
}

export async function deleteEntry(user: SessionUser, id: string) {
  const res = await getDb().delete(nutritionEntries).where(and(eq(nutritionEntries.id, id), eq(nutritionEntries.userId, user.id))).returning({ id: nutritionEntries.id, mealId: nutritionEntries.mealId });
  if (!res.length) throw notFound("Entry");
  // Drop meals left empty.
  if (res[0].mealId) {
    await getDb().delete(meals).where(and(eq(meals.id, res[0].mealId), sql`not exists (select 1 from nutrition_entries e where e.meal_id = ${meals.id})`));
  }
}

/* ------------------------------------ Days ---------------------------------- */

export async function getDay(user: SessionUser, date?: string) {
  const tz = user.settings.timezone;
  const day = date ?? toLocalDate(new Date(), tz);
  const { start, end } = localDayRange(day, tz);
  const db = getDb();
  const [rows, goal] = await Promise.all([
    db
      .select({ e: nutritionEntries, mealName: meals.name })
      .from(nutritionEntries)
      .leftJoin(meals, eq(meals.id, nutritionEntries.mealId))
      .where(and(eq(nutritionEntries.userId, user.id), gte(nutritionEntries.consumedAt, start), lt(nutritionEntries.consumedAt, end)))
      .orderBy(asc(nutritionEntries.consumedAt)),
    getActiveGoal(user.id),
  ]);
  const entries = rows.map((r) => entryDto(r.e, r.mealName));
  const groups = new Map<string, typeof entries>();
  for (const e of entries) groups.set(e.mealName, [...(groups.get(e.mealName) ?? []), e]);
  const totals = sumMacros(entries);
  return {
    date: day,
    totals,
    goal: goalDto(goal),
    progress: compareToGoal(totals, goalTargets(goal)),
    meals: [...groups.entries()].map(([name, items]) => ({ name, items, totals: sumMacros(items) })),
  };
}

export async function history(user: SessionUser, from: string, to: string) {
  const tz = user.settings.timezone;
  if (from > to) throw badRequest("`from` must be on or before `to`");
  if (Date.parse(to) - Date.parse(from) > 366 * 86_400_000) throw badRequest("Range can be at most one year");
  const { start } = localDayRange(from, tz);
  const { end } = localDayRange(to, tz);
  const localDay = sql<string>`(${nutritionEntries.consumedAt} at time zone ${tz})::date::text`;
  const rows = await getDb()
    .select({
      day: localDay,
      calories: sql<number>`coalesce(sum(${nutritionEntries.calories}),0)::float`,
      proteinG: sql<number>`coalesce(sum(${nutritionEntries.proteinG}),0)::float`,
      carbsG: sql<number>`coalesce(sum(${nutritionEntries.carbsG}),0)::float`,
      fatG: sql<number>`coalesce(sum(${nutritionEntries.fatG}),0)::float`,
      fiberG: sql<number>`coalesce(sum(${nutritionEntries.fiberG}),0)::float`,
      entries: sql<number>`count(*)::int`,
    })
    .from(nutritionEntries)
    .where(and(eq(nutritionEntries.userId, user.id), gte(nutritionEntries.consumedAt, start), lt(nutritionEntries.consumedAt, end)))
    // Ordinal references: repeating a parameterised expression would bind it twice and Postgres rejects the mismatch.
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const days: Array<{ date: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number; entries: number }> = [];
  for (let d = from; d <= to; d = addDaysToDateString(d, 1)) {
    const r = byDay.get(d);
    days.push({ date: d, calories: r?.calories ?? 0, proteinG: r?.proteinG ?? 0, carbsG: r?.carbsG ?? 0, fatG: r?.fatG ?? 0, fiberG: r?.fiberG ?? 0, entries: r?.entries ?? 0 });
  }
  const logged = days.filter((d) => d.entries > 0);
  const avg = (k: "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG") => (logged.length ? Math.round((logged.reduce((s, d) => s + d[k], 0) / logged.length) * 10) / 10 : 0);
  return {
    from,
    to,
    goal: goalDto(await getActiveGoal(user.id)),
    days,
    averages: { calories: avg("calories"), proteinG: avg("proteinG"), carbsG: avg("carbsG"), fatG: avg("fatG"), fiberG: avg("fiberG"), loggedDays: logged.length },
  };
}

/* ---------------------------------- Share cards ----------------------------- */

const METRIC_LABELS = { calories: "Calories", proteinG: "Protein", carbsG: "Carbs", fatG: "Fat", fiberG: "Fiber" } as const;

export async function createShareCard(user: SessionUser, date: string, metrics: Array<keyof typeof METRIC_LABELS>) {
  const day = await getDay(user, date);
  if (day.meals.length === 0) throw badRequest("Nothing logged on that day yet", "NOTHING_TO_SHARE");
  const snapshot: Record<string, number> = {};
  for (const m of new Set(metrics)) snapshot[m] = day.totals[m];
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [c] = await getDb()
        .insert(nutritionShareCards)
        .values({ shortId: shortId(10), userId: user.id, day: date, metrics: snapshot, visibility: "PUBLIC" })
        .returning();
      return { id: c.shortId, url: `/s/${c.shortId}` };
    } catch (e) {
      if ((e as { code?: string }).code !== "23505") throw e;
    }
  }
  throw badRequest("Couldn't create the share card, please retry");
}

/** Public share card: only the metrics the owner chose, never food names, notes or photos. */
export async function getShareCard(id: string) {
  const [row] = await getDb().select().from(nutritionShareCards).where(eq(nutritionShareCards.shortId, id)).limit(1);
  if (!row) throw notFound("Share card");
  const [owner] = await getDb().execute<{ username: string; display_name: string; status: string }>(sql`select username, display_name, status from users where id = ${row.userId}`).then((r) => r.rows);
  if (!owner || owner.status !== "active") throw notFound("Share card");
  return {
    id: row.shortId,
    date: row.day,
    owner: { username: owner.username, displayName: owner.display_name },
    metrics: Object.entries(row.metrics).map(([key, value]) => ({ key, label: METRIC_LABELS[key as keyof typeof METRIC_LABELS] ?? key, value })),
  };
}

export async function deleteShareCard(user: SessionUser, id: string) {
  const res = await getDb().delete(nutritionShareCards).where(and(eq(nutritionShareCards.shortId, id), eq(nutritionShareCards.userId, user.id))).returning({ id: nutritionShareCards.id });
  if (!res.length) throw notFound("Share card");
}

