import type { Metadata } from "next";
import { ExerciseDetail } from "./exercise-detail";

export const metadata: Metadata = { title: "Exercise" };

export default async function Page({ params }: PageProps<"/exercises/[id]">) {
  const { id } = await params;
  return <ExerciseDetail id={id} />;
}
