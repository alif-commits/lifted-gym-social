import type { Metadata } from "next";
import { EditTemplate } from "./edit-template";

export const metadata: Metadata = { title: "Edit template" };

export default async function Page({ params }: PageProps<"/templates/[id]">) {
  const { id } = await params;
  return <EditTemplate id={id} />;
}
