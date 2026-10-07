import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateCalories, calculateAge } from "@/lib/calc/calories";
import { compareToGoal, convertQuantity, normalizeFoodName, scaleFood, sumMacros } from "@/lib/calc/nutrition";
import { estimateOneRepMax } from "@/lib/calc/one-rep-max";
import { computeWorkoutStats, detectRecords, recordCandidates, type CalcSet } from "@/lib/calc/workout";

const set = (p: Partial<CalcSet>): CalcSet => ({ setType: "NORMAL", weight: null, reps: null, durationSeconds: null, distance: null, completed: true, ...p });

describe("one rep max", () => {
  it("returns the weight for a single", () => assert.equal(estimateOneRepMax(100, 1), 100));
  it("uses Epley by default", () => assert.equal(estimateOneRepMax(100, 5), 116.7));
  it("supports Brzycki and Lombardi", () => {
    assert.equal(estimateOneRepMax(100, 5, "BRZYCKI"), 112.5);
    assert.equal(estimateOneRepMax(100, 5, "LOMBARDI"), 117.5);
  });
  it("refuses unreliable inputs", () => {
    assert.equal(estimateOneRepMax(100, 13), null);
    assert.equal(estimateOneRepMax(0, 5), null);
    assert.equal(estimateOneRepMax(null, 5), null);
    assert.equal(estimateOneRepMax(100, 0), null);
  });
});

describe("calorie calculator", () => {
  const base = { age: 30, sex: "MALE", heightCm: 180, weightKg: 80, activityLevel: "MODERATE" } as const;
  it("computes Mifflin-St Jeor BMR", () => {
    const r = calculateCalories({ ...base, goal: "MAINTAIN" });
    assert.equal(r.bmr, 1780); // 10*80 + 6.25*180 - 5*30 + 5
    assert.equal(r.targetCalories, r.tdee);
  });
  it("applies deficit and surplus", () => {
    const m = calculateCalories({ ...base, goal: "MAINTAIN" });
    assert.equal(calculateCalories({ ...base, goal: "LOSE" }).targetCalories, m.tdee - 500);
    assert.equal(calculateCalories({ ...base, goal: "GAIN" }).targetCalories, m.tdee + 300);
  });
  it("never goes below the safety floor", () => {
    const r = calculateCalories({ age: 40, sex: "FEMALE", heightCm: 150, weightKg: 45, activityLevel: "SEDENTARY", goal: "LOSE", adjustmentKcal: 1000 });
    assert.equal(r.targetCalories, 1200);
    assert.ok(r.warnings.some((w) => w.includes("safety floor")));
  });
  it("calculates age on birthdays correctly", () => {
    assert.equal(calculateAge("2000-06-15", new Date("2026-06-14T12:00:00Z")), 25);
    assert.equal(calculateAge("2000-06-15", new Date("2026-06-15T12:00:00Z")), 26);
  });
});

describe("nutrition scaling", () => {
  const chicken = { servingSize: 100, servingUnit: "g", calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: null };
  it("scales by quantity", () => {
    const s = scaleFood(chicken, 150, "g")!;
    assert.equal(s.calories, 247.5);
    assert.equal(s.proteinG, 46.5);
    assert.equal(s.fiberG, 0);
  });
  it("converts compatible units", () => {
    assert.equal(convertQuantity(1, "kg", "g"), 1000);
    assert.equal(scaleFood(chicken, 1, "kg")!.calories, 1650);
    assert.equal(convertQuantity(1, "cup", "ml"), 240);
  });
  it("rejects incompatible units", () => {
    assert.equal(convertQuantity(1, "g", "ml"), null);
    assert.equal(scaleFood(chicken, 1, "piece"), null);
  });
  it("sums macros and compares to goal", () => {
    const total = sumMacros([{ calories: 100.04, proteinG: 10 }, { calories: 200, proteinG: 5, fiberG: 3 }]);
    assert.deepEqual(total, { calories: 300, proteinG: 15, carbsG: 0, fatG: 0, fiberG: 3 });
    const cmp = compareToGoal(total, { calories: 2000, proteinG: 150, carbsG: 200, fatG: 60, fiberG: null });
    assert.equal(cmp.calories.remaining, 1700);
    assert.equal(cmp.calories.percent, 15);
    assert.equal(cmp.fiberG.target, null);
    assert.equal(cmp.fiberG.percent, null);
  });
  it("normalises food names", () => assert.equal(normalizeFoodName("  Grilled  Chicken-Breast! "), "grilled chicken breast"));
});

describe("workout stats and records", () => {
  const bench = { exerciseId: "1", name: "Bench", trackingMode: "WEIGHT_REPS", sets: [set({ setType: "WARMUP", weight: 40, reps: 10 }), set({ weight: 100, reps: 5 }), set({ weight: 100, reps: 5, completed: false }), set({ weight: 90, reps: 8 })] };
  it("counts only completed, non-warmup sets", () => {
    assert.deepEqual(computeWorkoutStats([bench]), { exerciseCount: 1, setCount: 2, repCount: 13, volume: 1220 });
  });
  it("derives record candidates", () => {
    const c = recordCandidates(bench, "kg");
    assert.equal(c.find((r) => r.recordType === "MAX_WEIGHT")?.value, 100);
    assert.equal(c.find((r) => r.recordType === "EXERCISE_VOLUME")?.value, 1220);
  });
  it("only flags improvements over a previous best, but baselines first-timers", () => {
    const cands = [{ recordType: "MAX_WEIGHT", value: 100, unit: "kg" }, { recordType: "ESTIMATED_1RM", value: 120, unit: "kg" }, { recordType: "EXERCISE_VOLUME", value: 900, unit: "kg" }] as const;
    const out = detectRecords([...cands], { MAX_WEIGHT: 95, EXERCISE_VOLUME: 1000 });
    assert.deepEqual(out.map((r) => [r.recordType, r.isImprovement, r.previousValue]), [["MAX_WEIGHT", true, 95], ["ESTIMATED_1RM", false, null]]);
  });
});
