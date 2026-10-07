import type { Metadata } from "next";
import { Suspense } from "react";
import { NutritionDashboard } from "./dashboard";

export const metadata: Metadata = { title: "Nutrition" };

export default function Page() {
  return (
    <Suspense>
      <NutritionDashboard />
    </Suspense>
  );
}
