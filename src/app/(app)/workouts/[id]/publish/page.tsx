import type { Metadata } from "next";
import { PublishForm } from "./publish-form";

export const metadata: Metadata = { title: "Share workout" };

export default async function Page({ params }: PageProps<"/workouts/[id]/publish">) {
  const { id } = await params;
  return <PublishForm workoutId={id} />;
}
