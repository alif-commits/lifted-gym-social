import type { Metadata } from "next";
import { ExerciseLibrary } from "./library";

export const metadata: Metadata = { title: "Exercises" };

export default function Page() {
  return <ExerciseLibrary />;
}
