import type { Metadata } from "next";
import { WorkoutDetail } from "./workout-detail";

export const metadata: Metadata = { title: "Workout" };

export default async function Page({ params }: PageProps<"/workouts/[id]">) {
  const { id } = await params;
  return <WorkoutDetail id={id} />;
}
