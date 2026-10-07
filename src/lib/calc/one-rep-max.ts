import type { OneRepMaxFormula } from "@/lib/constants";

export const DEFAULT_ONE_RM_FORMULA: OneRepMaxFormula = "EPLEY";

/** Highest rep count for which a 1RM estimate is considered meaningful. */
export const ONE_RM_MAX_REPS = 12;

/**
 * Estimated one-rep max. Returns `null` when the input cannot produce a meaningful estimate
 * (no weight, no reps, or reps above {@link ONE_RM_MAX_REPS}).
 */
export function estimateOneRepMax(
  weight: number | null | undefined,
  reps: number | null | undefined,
  formula: OneRepMaxFormula = DEFAULT_ONE_RM_FORMULA,
): number | null {
  if (!weight || !reps || weight <= 0 || reps <= 0 || reps > ONE_RM_MAX_REPS) return null;
  if (reps === 1) return round1(weight);
  switch (formula) {
    case "EPLEY":
      return round1(weight * (1 + reps / 30));
    case "BRZYCKI":
      return round1((weight * 36) / (37 - reps));
    case "LOMBARDI":
      return round1(weight * Math.pow(reps, 0.1));
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
