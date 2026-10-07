import type { FoodUnit } from "@/lib/constants";

export type Macros = {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
};

export type FoodBasis = {
  servingSize: number;
  servingUnit: string;
} & Omit<Macros, "fiberG"> & { fiberG: number | null };

export const ZERO_MACROS: Macros = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };

type UnitGroup = "mass" | "volume" | "count";
const UNIT_TABLE: Record<FoodUnit, { group: UnitGroup; factor: number }> = {
  g: { group: "mass", factor: 1 },
  kg: { group: "mass", factor: 1000 },
  oz: { group: "mass", factor: 28.3495 },
  lb: { group: "mass", factor: 453.592 },
  ml: { group: "volume", factor: 1 },
  l: { group: "volume", factor: 1000 },
  cup: { group: "volume", factor: 240 },
  tbsp: { group: "volume", factor: 15 },
  tsp: { group: "volume", factor: 5 },
  serving: { group: "count", factor: 1 },
  piece: { group: "count", factor: 1 },
  slice: { group: "count", factor: 1 },
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Convert a quantity between compatible units (mass, volume, count).
 * Returns `null` when the units are incompatible.
 */
export function convertQuantity(quantity: number, from: string, to: string): number | null {
  if (from === to) return quantity;
  const a = UNIT_TABLE[from as FoodUnit];
  const b = UNIT_TABLE[to as FoodUnit];
  if (!a || !b) return null;
  if (a.group === "count" && b.group === "count") return quantity;
  if (a.group !== b.group) return null;
  return (quantity * a.factor) / b.factor;
}

export function compatibleUnits(servingUnit: string): FoodUnit[] {
  const base = UNIT_TABLE[servingUnit as FoodUnit];
  if (!base) return [servingUnit as FoodUnit];
  return (Object.keys(UNIT_TABLE) as FoodUnit[]).filter((u) => UNIT_TABLE[u].group === base.group);
}

/**
 * Scale a food's nutrition values to the quantity eaten.
 * Deterministic: the multiplier is `quantity (in serving unit) / servingSize`.
 */
export function scaleFood(food: FoodBasis, quantity: number, unit: string): Macros | null {
  if (!(quantity >= 0) || !(food.servingSize > 0)) return null;
  const inServingUnit = convertQuantity(quantity, unit, food.servingUnit);
  if (inServingUnit === null) return null;
  const m = inServingUnit / food.servingSize;
  return {
    calories: round1(food.calories * m),
    proteinG: round1(food.proteinG * m),
    carbsG: round1(food.carbsG * m),
    fatG: round1(food.fatG * m),
    fiberG: round1((food.fiberG ?? 0) * m),
  };
}

export function sumMacros(items: Array<Partial<Omit<Macros, "fiberG">> & { fiberG?: number | null }>): Macros {
  const total = items.reduce<Macros>(
    (acc, i) => ({
      calories: acc.calories + (i.calories ?? 0),
      proteinG: acc.proteinG + (i.proteinG ?? 0),
      carbsG: acc.carbsG + (i.carbsG ?? 0),
      fatG: acc.fatG + (i.fatG ?? 0),
      fiberG: acc.fiberG + (i.fiberG ?? 0),
    }),
    { ...ZERO_MACROS },
  );
  return {
    calories: round1(total.calories),
    proteinG: round1(total.proteinG),
    carbsG: round1(total.carbsG),
    fatG: round1(total.fatG),
    fiberG: round1(total.fiberG),
  };
}

export type GoalTargets = { calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number | null };

export type GoalComparison = Record<keyof Macros, { consumed: number; target: number | null; remaining: number | null; percent: number | null }>;

export function compareToGoal(totals: Macros, goal: GoalTargets | null): GoalComparison {
  const row = (consumed: number, target: number | null) => ({
    consumed,
    target,
    remaining: target === null ? null : round1(target - consumed),
    percent: target ? Math.round((consumed / target) * 100) : null,
  });
  return {
    calories: row(totals.calories, goal?.calories ?? null),
    proteinG: row(totals.proteinG, goal?.proteinG ?? null),
    carbsG: row(totals.carbsG, goal?.carbsG ?? null),
    fatG: row(totals.fatG, goal?.fatG ?? null),
    fiberG: row(totals.fiberG, goal?.fiberG ?? null),
  };
}

/** Normalise a free-text food name for matching ("Grilled  Chicken Breast!" → "grilled chicken breast"). */
export function normalizeFoodName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
