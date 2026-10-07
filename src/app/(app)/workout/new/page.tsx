import type { Metadata } from "next";
import { Suspense } from "react";
import { StartWorkout } from "./start-workout";

export const metadata: Metadata = { title: "Start workout" };

export default function Page() {
  return (
    <Suspense>
      <StartWorkout />
    </Suspense>
  );
}
