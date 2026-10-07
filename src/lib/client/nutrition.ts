import type { Serialized } from "./api";
import type { getDay, history, foodDto } from "@/server/services/nutrition";

export type DayData = Serialized<Awaited<ReturnType<typeof getDay>>>;
export type DayEntry = DayData["meals"][number]["items"][number];
export type HistoryData = Serialized<Awaited<ReturnType<typeof history>>>;
export type Food = Serialized<ReturnType<typeof foodDto>>;

export const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack", "Pre-Workout", "Post-Workout", "Other"] as const;

/** Sensible default meal name from the local hour. */
export function defaultMeal(date = new Date()): (typeof MEALS)[number] {
  const h = date.getHours();
  if (h < 10) return "Breakfast";
  if (h < 15) return "Lunch";
  if (h < 21) return "Dinner";
  return "Snack";
}

/** consumedAt for a chosen calendar day: "now" for today, local noon for other days. */
export function consumedAtFor(day: string, today: string): string | undefined {
  return day === today ? undefined : new Date(`${day}T12:00:00`).toISOString();
}

export const kcal = (n: number) => Math.round(n).toLocaleString();
export const grams = (n: number) => `${Math.round(n * 10) / 10}g`;
