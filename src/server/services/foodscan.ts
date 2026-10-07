import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { after } from "next/server";
import { normalizeFoodName, scaleFood } from "@/lib/calc/nutrition";
import { toLocalDate } from "@/lib/tz";
import type { VisionOutput } from "@/lib/validators/foodscan";
import { confirmScanSchema, scanItemCreateSchema, scanItemUpdateSchema } from "@/lib/validators/foodscan";
import type { z } from "zod";
import { getFoodVisionProvider } from "@/server/ai/food-vision";
import type { SessionUser } from "@/server/auth/session";
import { config } from "@/server/config";
import { getDb, type DbOrTx } from "@/server/db";
import { foodItems, foodScanItems, foodScans, nutritionEntries } from "@/server/db/schema";
import { badRequest, conflict, notFound } from "@/server/http/errors";
import { randomToken, sha256Hex } from "@/server/lib/ids";
import { mediaUrl, getStorage } from "@/server/storage";
import { processFoodImage } from "./images";
import { entryDto, findOrCreateMeal, getAccessibleFood } from "./nutrition";

type Scan = typeof foodScans.$inferSelect;
type ScanItem = typeof foodScanItems.$inferSelect;

const STUCK_AFTER_MS = 3 * 60 * 1000;
const REUSE_WINDOW_MS = 10 * 60 * 1000;
const AI_TIMEOUT_MS = 40_000;
/** Below this overall confidence an item is flagged for the user to double check. */
export const LOW_CONFIDENCE = 0.6;

/* ---------------------------------- DTOs ----------------------------------- */

const itemDto = (i: ScanItem) => ({
  id: i.id,
  recognizedName: i.recognizedName,
  matchedFoodId: i.matchedFoodId,
  estimatedQuantity: i.estimatedQuantity,
  estimatedUnit: i.estimatedUnit,
  calories: i.calories,
  proteinG: i.proteinG,
  carbsG: i.carbsG,
  fatG: i.fatG,
  fiberG: i.fiberG,
  confidence: {
    overall: i.confidence,
    vision: i.visionConfidence,
    foodMatch: i.foodMatchConfidence,
    portion: i.portionConfidence,
  },
  source: i.source,
  needsReview: i.calories === null || (i.confidence ?? 0) < LOW_CONFIDENCE,
});

const scanDto = (s: Scan, items: ScanItem[]) => ({
  id: s.id,
  status: s.status,
  errorCode: s.errorCode,
  provider: s.provider,
  imageUrl: mediaUrl(s.storageKey),
  createdAt: s.createdAt,
  completedAt: s.completedAt,
  confirmedAt: s.confirmedAt,
  items: items.map(itemDto),
});
export type FoodScanDto = ReturnType<typeof scanDto>;

async function loadScan(userId: string, id: string, db: DbOrTx = getDb()) {
  const [scan] = await db.select().from(foodScans).where(and(eq(foodScans.id, id), eq(foodScans.userId, userId))).limit(1);
  if (!scan) throw notFound("Scan");
  return scan;
}

const loadItems = (db: DbOrTx, scanId: string) => db.select().from(foodScanItems).where(eq(foodScanItems.foodScanId, scanId)).orderBy(foodScanItems.createdAt, foodScanItems.id);

export async function getScan(user: SessionUser, id: string) {
  const db = getDb();
  let scan = await loadScan(user.id, id);
  // A worker that died mid-flight must not leave the user polling forever.
  if (scan.status === "PROCESSING" && Date.now() - scan.updatedAt.getTime() > STUCK_AFTER_MS) {
    const [failed] = await db
      .update(foodScans)
      .set({ status: "FAILED", errorCode: "TIMEOUT" })
      .where(and(eq(foodScans.id, id), eq(foodScans.status, "PROCESSING")))
      .returning();
    if (failed) scan = failed;
  }
  return scanDto(scan, await loadItems(db, id));
}

export async function listScans(user: SessionUser, limit = 20) {
  const rows = await getDb().select().from(foodScans).where(eq(foodScans.userId, user.id)).orderBy(desc(foodScans.createdAt)).limit(limit);
  return rows.map((s) => ({ id: s.id, status: s.status, imageUrl: mediaUrl(s.storageKey), createdAt: s.createdAt }));
}

/* --------------------------------- Creation -------------------------------- */

export async function createScan(user: SessionUser, upload: Buffer) {
  const db = getDb();
  const processed = await processFoodImage(upload);
  const hash = sha256Hex(processed.buffer);

  // Re-uploading the same photo shortly after returns the previous analysis instead of paying for a second AI call.
  const [recent] = await db
    .select()
    .from(foodScans)
    .where(and(eq(foodScans.userId, user.id), eq(foodScans.contentHash, hash), inArray(foodScans.status, ["PROCESSING", "COMPLETED"]), sql`${foodScans.createdAt} > now() - ${REUSE_WINDOW_MS / 1000} * interval '1 second'`))
    .orderBy(desc(foodScans.createdAt))
    .limit(1);
  if (recent) return { scan: scanDto(recent, await loadItems(db, recent.id)), reused: true };

  const provider = getFoodVisionProvider();
  const key = `food/${user.id}/${randomToken(9).replace(/[^a-zA-Z0-9]/g, "x")}.jpg`;
  await getStorage().put(key, processed.buffer, "image/jpeg");
  const [scan] = await db
    .insert(foodScans)
    .values({ userId: user.id, storageKey: key, contentHash: hash, mimeType: "image/jpeg", sizeBytes: processed.buffer.length, status: "PROCESSING", provider: provider.name, model: provider.model })
    .returning();

  // Respond immediately; the client polls GET /food-scans/:id.
  after(() => runScan(scan.id).catch((e) => console.error(JSON.stringify({ level: "error", msg: "food scan crashed", scanId: scan.id, error: String(e) }))));
  return { scan: scanDto(scan, []), reused: false };
}

/* ----------------------------- Nutrition resolver --------------------------- */

type Resolved = { foodId: string | null; match: number; macros: ReturnType<typeof scaleFood>; quantity: number; unit: string; portionPenalty: boolean };

/** Match a recognised food name against the nutrition database. Never lets the model invent macro values. */
async function resolveFood(userId: string, item: VisionOutput["items"][number]): Promise<Resolved> {
  const name = normalizeFoodName(item.name);
  const db = getDb();
  const rows = await db.execute<{ id: string; sim: number }>(sql`
    select id, similarity(lower(name), ${name}) as sim
    from food_items
    where (is_global = true or owner_user_id = ${userId}::uuid)
      and (lower(name) % ${name} or lower(name) like ${"%" + name + "%"})
    order by (lower(name) = ${name}) desc, (owner_user_id is not null) desc, sim desc, length(name)
    limit 1`);
  const hit = rows.rows[0];
  if (!hit) return { foodId: null, match: 0, macros: null, quantity: item.estimatedQuantity, unit: item.unit, portionPenalty: false };

  const [food] = await db.select().from(foodItems).where(eq(foodItems.id, hit.id)).limit(1);
  const exact = normalizeFoodName(food.name) === name;
  const match = exact ? 1 : Math.max(0.4, Math.min(0.95, Number(hit.sim) + 0.15));
  let macros = scaleFood(food, item.estimatedQuantity, item.unit);
  let quantity = item.estimatedQuantity;
  let unit: string = item.unit;
  let portionPenalty = false;
  if (!macros) {
    // Incompatible units (e.g. "piece" for a food stored per 100 g): fall back to one standard serving.
    quantity = food.servingSize;
    unit = food.servingUnit;
    macros = scaleFood(food, quantity, unit);
    portionPenalty = true;
  }
  return { foodId: food.id, match, macros, quantity, unit, portionPenalty };
}

/* --------------------------------- Pipeline -------------------------------- */

/** Run (or resume) analysis for a scan. Safe to call more than once: only one caller can claim each attempt. */
export async function runScan(scanId: string): Promise<void> {
  const db = getDb();
  const provider = getFoodVisionProvider();

  for (let attempt = 1; attempt <= config.ai.maxAttempts; attempt++) {
    const [claimed] = await db
      .update(foodScans)
      .set({ attempts: sql`${foodScans.attempts} + 1` })
      .where(and(eq(foodScans.id, scanId), eq(foodScans.status, "PROCESSING")))
      .returning();
    if (!claimed) return; // cancelled, finished, or handled elsewhere

    try {
      const image = await getStorage().getBuffer(claimed.storageKey);
      if (!image) throw new Error("image missing");
      const output = await provider.analyze({ data: image, mediaType: claimed.mimeType }, AbortSignal.timeout(AI_TIMEOUT_MS));

      if (!output.isFood || output.items.length === 0) {
        await db.update(foodScans).set({ status: "FAILED", errorCode: "NO_FOOD_DETECTED", completedAt: new Date() }).where(and(eq(foodScans.id, scanId), eq(foodScans.status, "PROCESSING")));
        return;
      }

      const resolved = await Promise.all(output.items.map((it) => resolveFood(claimed.userId, it)));
      await db.transaction(async (tx) => {
        // Only publish results if the scan wasn't cancelled while the model was thinking.
        const [still] = await tx.update(foodScans).set({ status: "COMPLETED", errorCode: null, completedAt: new Date() }).where(and(eq(foodScans.id, scanId), eq(foodScans.status, "PROCESSING"))).returning({ id: foodScans.id });
        if (!still) return;
        await tx.insert(foodScanItems).values(
          output.items.map((it, i) => {
            const r = resolved[i];
            const portion = r.portionPenalty ? Math.min(it.portionConfidence, 0.3) : it.portionConfidence;
            return {
              foodScanId: scanId,
              recognizedName: it.name.slice(0, 160),
              matchedFoodId: r.foodId,
              estimatedQuantity: r.quantity,
              estimatedUnit: r.unit,
              calories: r.macros?.calories ?? null,
              proteinG: r.macros?.proteinG ?? null,
              carbsG: r.macros?.carbsG ?? null,
              fatG: r.macros?.fatG ?? null,
              fiberG: r.macros?.fiberG ?? null,
              visionConfidence: it.confidence,
              foodMatchConfidence: r.match,
              portionConfidence: portion,
              // Overall confidence is the weakest link, weighted: a wrong match or bad portion both hurt the number.
              confidence: Math.round(it.confidence * r.match * (0.6 + 0.4 * portion) * 100) / 100,
              source: "AI",
            };
          }),
        );
      });
      return;
    } catch (e) {
      console.error(JSON.stringify({ level: "warn", msg: "food scan attempt failed", scanId, attempt, error: String(e) }));
      if (attempt >= config.ai.maxAttempts) {
        await db.update(foodScans).set({ status: "FAILED", errorCode: "AI_UNAVAILABLE", completedAt: new Date() }).where(and(eq(foodScans.id, scanId), eq(foodScans.status, "PROCESSING")));
      }
    }
  }
}

export async function retryScan(user: SessionUser, id: string) {
  const db = getDb();
  const scan = await loadScan(user.id, id);
  if (scan.status !== "FAILED") throw conflict("Only failed scans can be retried", "INVALID_STATE");
  const [updated] = await db.update(foodScans).set({ status: "PROCESSING", errorCode: null, attempts: 0, completedAt: null }).where(and(eq(foodScans.id, id), eq(foodScans.status, "FAILED"))).returning();
  if (!updated) throw conflict("Scan already restarted", "INVALID_STATE");
  after(() => runScan(id).catch(() => undefined));
  return scanDto(updated, []);
}

export async function cancelScan(user: SessionUser, id: string) {
  const scan = await loadScan(user.id, id);
  if (scan.status === "CANCELLED") return;
  if (!["PROCESSING", "COMPLETED", "FAILED"].includes(scan.status)) throw conflict("This scan can no longer be cancelled", "INVALID_STATE");
  await getDb().update(foodScans).set({ status: "CANCELLED" }).where(and(eq(foodScans.id, id), inArray(foodScans.status, ["PROCESSING", "COMPLETED", "FAILED"])));
}

/* ------------------------------- Review editing ----------------------------- */

async function requireReviewable(userId: string, id: string, db: DbOrTx = getDb()) {
  const scan = await loadScan(userId, id, db);
  if (scan.status !== "COMPLETED") throw conflict("This scan can't be edited right now", "INVALID_STATE");
  return scan;
}

export async function updateScanItem(user: SessionUser, scanId: string, itemId: string, patch: z.infer<typeof scanItemUpdateSchema>) {
  const db = getDb();
  await requireReviewable(user.id, scanId);
  const [cur] = await db.select().from(foodScanItems).where(and(eq(foodScanItems.id, itemId), eq(foodScanItems.foodScanId, scanId))).limit(1);
  if (!cur) throw notFound("Scan item");

  const set: Partial<typeof foodScanItems.$inferInsert> = { source: "USER", userConfirmed: true };
  if (patch.recognizedName !== undefined) set.recognizedName = patch.recognizedName;
  if (patch.estimatedQuantity !== undefined) set.estimatedQuantity = patch.estimatedQuantity;
  if (patch.estimatedUnit !== undefined) set.estimatedUnit = patch.estimatedUnit;
  if (patch.matchedFoodId !== undefined) set.matchedFoodId = patch.matchedFoodId;

  const macrosSent = (["calories", "proteinG", "carbsG", "fatG", "fiberG"] as const).some((k) => k in patch);
  if (macrosSent) {
    for (const k of ["calories", "proteinG", "carbsG", "fatG", "fiberG"] as const) if (k in patch) set[k] = patch[k] ?? null;
  } else if (patch.matchedFoodId !== undefined || patch.estimatedQuantity !== undefined || patch.estimatedUnit !== undefined) {
    // Re-derive nutrition deterministically from the (possibly new) food and portion.
    const foodId = patch.matchedFoodId === undefined ? cur.matchedFoodId : patch.matchedFoodId;
    if (foodId) {
      const food = await getAccessibleFood(user.id, foodId);
      if (!food) throw notFound("Food");
      const scaled = scaleFood(food, (patch.estimatedQuantity ?? cur.estimatedQuantity) ?? food.servingSize, (patch.estimatedUnit ?? cur.estimatedUnit) ?? food.servingUnit);
      if (!scaled) throw badRequest(`Can't convert that unit to ${food.servingUnit} for this food`, "INCOMPATIBLE_UNIT");
      Object.assign(set, { calories: scaled.calories, proteinG: scaled.proteinG, carbsG: scaled.carbsG, fatG: scaled.fatG, fiberG: scaled.fiberG });
      if (patch.matchedFoodId) set.foodMatchConfidence = 1;
    }
  }
  const [row] = await db.update(foodScanItems).set(set).where(eq(foodScanItems.id, itemId)).returning();
  return itemDto(row);
}

export async function addScanItem(user: SessionUser, scanId: string, input: z.infer<typeof scanItemCreateSchema>) {
  const db = getDb();
  await requireReviewable(user.id, scanId);
  if (input.matchedFoodId && !(await getAccessibleFood(user.id, input.matchedFoodId))) throw notFound("Food");
  const [row] = await db
    .insert(foodScanItems)
    .values({
      foodScanId: scanId,
      recognizedName: input.recognizedName,
      matchedFoodId: input.matchedFoodId ?? null,
      estimatedQuantity: input.estimatedQuantity,
      estimatedUnit: input.estimatedUnit,
      calories: input.calories,
      proteinG: input.proteinG,
      carbsG: input.carbsG,
      fatG: input.fatG,
      fiberG: input.fiberG ?? null,
      confidence: 1,
      visionConfidence: 1,
      foodMatchConfidence: 1,
      portionConfidence: 1,
      source: "USER",
      userConfirmed: true,
    })
    .returning();
  return itemDto(row);
}

export async function deleteScanItem(user: SessionUser, scanId: string, itemId: string) {
  await requireReviewable(user.id, scanId);
  const res = await getDb().delete(foodScanItems).where(and(eq(foodScanItems.id, itemId), eq(foodScanItems.foodScanId, scanId))).returning({ id: foodScanItems.id });
  if (!res.length) throw notFound("Scan item");
}

/* ---------------------------------- Confirm -------------------------------- */

/**
 * Convert reviewed scan items to nutrition entries in a single transaction.
 * Idempotent: confirming twice returns the same entries (guarded by the scan row lock + unique scan_item_id).
 */
export async function confirmScan(user: SessionUser, scanId: string, input: z.infer<typeof confirmScanSchema>) {
  return getDb().transaction(async (tx) => {
    const [scan] = await tx.select().from(foodScans).where(and(eq(foodScans.id, scanId), eq(foodScans.userId, user.id))).for("update");
    if (!scan) throw notFound("Scan");

    if (scan.status === "CONFIRMED") {
      const rows = await tx.select().from(nutritionEntries).where(and(eq(nutritionEntries.userId, user.id), inArray(nutritionEntries.foodScanItemId, tx.select({ id: foodScanItems.id }).from(foodScanItems).where(eq(foodScanItems.foodScanId, scanId)))));
      return { entries: rows.map((e) => entryDto(e, input.mealName)), alreadyConfirmed: true };
    }
    if (scan.status !== "COMPLETED") throw conflict("This scan isn't ready to confirm", "INVALID_STATE");

    const items = await loadItems(tx, scanId);
    if (items.length === 0) throw badRequest("Add at least one food before confirming", "NO_ITEMS");
    const incomplete = items.find((i) => i.calories === null || i.proteinG === null || i.carbsG === null || i.fatG === null || i.estimatedQuantity === null || !i.estimatedUnit);
    if (incomplete) throw badRequest(`Add nutrition values for "${incomplete.recognizedName}" or remove it`, "INCOMPLETE_ITEM");

    const consumedAt = input.consumedAt ? new Date(input.consumedAt) : new Date();
    const mealId = await findOrCreateMeal(tx, user, input.mealName, consumedAt);
    const created = await tx
      .insert(nutritionEntries)
      .values(
        items.map((i) => ({
          userId: user.id,
          mealId,
          foodItemId: i.matchedFoodId,
          foodScanItemId: i.id,
          source: "AI_SCAN",
          foodName: i.recognizedName,
          quantity: i.estimatedQuantity!,
          unit: i.estimatedUnit!,
          calories: i.calories!,
          proteinG: i.proteinG!,
          carbsG: i.carbsG!,
          fatG: i.fatG!,
          fiberG: i.fiberG,
          consumedAt,
          confidenceScore: i.confidence,
          notes: input.notes,
        })),
      )
      .returning();
    await tx.update(foodScans).set({ status: "CONFIRMED", confirmedAt: new Date() }).where(eq(foodScans.id, scanId));
    return { entries: created.map((e) => entryDto(e, input.mealName)), alreadyConfirmed: false, date: toLocalDate(consumedAt, user.settings.timezone) };
  });
}

/* ---------------------------------- Cleanup -------------------------------- */

/** Cron: fail scans stuck in PROCESSING and delete images of abandoned scans after 7 days. */
export async function cleanupScans() {
  const db = getDb();
  const stuck = await db
    .update(foodScans)
    .set({ status: "FAILED", errorCode: "TIMEOUT" })
    .where(and(eq(foodScans.status, "PROCESSING"), lt(foodScans.updatedAt, new Date(Date.now() - STUCK_AFTER_MS))))
    .returning({ id: foodScans.id });
  const old = await db
    .select({ id: foodScans.id, key: foodScans.storageKey })
    .from(foodScans)
    .where(and(inArray(foodScans.status, ["FAILED", "CANCELLED", "COMPLETED"]), lt(foodScans.createdAt, new Date(Date.now() - 7 * 86_400_000))))
    .limit(200);
  if (old.length) {
    await getStorage().delete(old.map((o) => o.key));
    await db.delete(foodScans).where(inArray(foodScans.id, old.map((o) => o.id)));
  }
  return { stuckFailed: stuck.length, imagesPurged: old.length };
}
