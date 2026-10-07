import type { Metadata } from "next";
import { TemplateEditor } from "../template-editor";

export const metadata: Metadata = { title: "New template" };

export default function Page() {
  return <TemplateEditor />;
}
