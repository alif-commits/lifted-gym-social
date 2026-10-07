import type { Metadata } from "next";
import { Recorder } from "./recorder";

export const metadata: Metadata = { title: "Workout in progress" };

export default async function Page({ params, searchParams }: PageProps<"/workout/[id]">) {
  const { id } = await params;
  const add = (await searchParams).add;
  return <Recorder id={id} addExerciseId={typeof add === "string" ? add : undefined} />;
}
