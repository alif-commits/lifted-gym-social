import type { Metadata } from "next";
import { ProgramEditor } from "../program-editor";

export const metadata: Metadata = { title: "New program" };

export default function Page() {
  return <ProgramEditor />;
}
