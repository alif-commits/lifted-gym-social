import type { Metadata } from "next";
import { EditProgram } from "./edit-program";

export const metadata: Metadata = { title: "Edit program" };

export default async function Page({ params }: PageProps<"/programs/[id]">) {
  const { id } = await params;
  return <EditProgram id={id} />;
}
