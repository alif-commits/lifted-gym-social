import type { Metadata } from "next";
import { NutritionHistory } from "./history";

export const metadata: Metadata = { title: "Nutrition history" };

export default function Page() {
  return <NutritionHistory />;
}
