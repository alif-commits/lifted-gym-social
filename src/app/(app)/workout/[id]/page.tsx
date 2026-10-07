import type { Metadata } from "next";
import { Recorder } from "./recorder";

export const metadata: Metadata = { title: "Workout in progress" };

export default async function Page({ params }: PageProps<"/workout/[id]">) {
  const { id } = await params;
  return <Recorder id={id} />;
}
