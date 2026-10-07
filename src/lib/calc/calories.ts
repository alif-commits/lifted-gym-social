import { ACTIVITY_MULTIPLIERS, type ActivityLevel, type NutritionGoal, type Sex } from "@/lib/constants";

export type CalorieInput = {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: NutritionGoal;
  /** Optional override for the kcal deficit/surplus applied to TDEE. */
  adjustmentKcal?: number;
};

export type CalorieResult = {
  formula: "MIFFLIN_ST_JEOR";
  settings: {
    activityMultiplier: number;
    adjustmentKcal: number;
    proteinPerKg: number;
    fatPercent: number;
    fiberPer1000Kcal: number;
  };
  bmr: number;
  tdee: number;
  targetCalories: number;
  macros: { proteinG: number; carbsG: number; fatG: number; fiberG: number };
  warnings: string[];
};

export const DEFAULT_DEFICIT_KCAL = 500;
export const DEFAULT_SURPLUS_KCAL = 300;
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

export function calculateAge(dateOfBirth: string | Date, now: Date = new Date()): number {
  const dob = typeof dateOfBirth === "string" ? new Date(`${dateOfBirth}T00:00:00Z`) : dateOfBirth;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

/** Mifflin-St Jeor basal metabolic rate (kcal/day). */
export function calculateBmr(input: Pick<CalorieInput, "age" | "sex" | "heightCm" | "weightKg">): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age;
  return Math.round((input.sex === "MALE" ? base + 5 : base - 161) * 10) / 10;
}

export function calculateCalories(input: CalorieInput): CalorieResult {
  const warnings: string[] = [];
  const multiplier = ACTIVITY_MULTIPLIERS[input.activityLevel];
  const bmr = calculateBmr(input);
  const tdee = Math.round(bmr * multiplier);

  const magnitude = Math.abs(
    input.adjustmentKcal ?? (input.goal === "LOSE" ? DEFAULT_DEFICIT_KCAL : DEFAULT_SURPLUS_KCAL),
  );
  const adjustment = input.goal === "LOSE" ? -magnitude : input.goal === "GAIN" ? magnitude : 0;

  const floor = input.sex === "MALE" ? 1500 : 1200;
  let target = Math.round(tdee + adjustment);
  if (target < floor) {
    warnings.push(`Target raised to the ${floor} kcal safety floor. Talk to a professional before eating less.`);
    target = floor;
  }

  const proteinPerKg = input.goal === "LOSE" ? 2.2 : 1.8;
  const fatPercent = 0.25;
  const fiberPer1000Kcal = 14;

  const proteinG = Math.round(input.weightKg * proteinPerKg);
  const fatG = Math.round((target * fatPercent) / KCAL_PER_G.fat);
  const carbKcal = Math.max(0, target - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat);
  const carbsG = Math.round(carbKcal / KCAL_PER_G.carbs);
  const fiberG = Math.round((target / 1000) * fiberPer1000Kcal);

  warnings.push("These numbers are estimates. Adjust them based on your real-world progress.");

  return {
    formula: "MIFFLIN_ST_JEOR",
    settings: {
      activityMultiplier: multiplier,
      adjustmentKcal: adjustment,
      proteinPerKg,
      fatPercent,
      fiberPer1000Kcal,
    },
    bmr,
    tdee,
    targetCalories: target,
    macros: { proteinG, carbsG, fatG, fiberG },
    warnings,
  };
}

/** Estimated calories burned: MET × kg × hours (strength training ≈ 5.0 MET). */
export const STRENGTH_TRAINING_MET = 5.0;
export function estimateCaloriesBurned(weightKg: number | null | undefined, durationSeconds: number): number | null {
  if (!weightKg || weightKg <= 0 || durationSeconds <= 0) return null;
  return Math.round(STRENGTH_TRAINING_MET * weightKg * (durationSeconds / 3600));
}
