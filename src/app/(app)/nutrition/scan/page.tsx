import type { Metadata } from "next";
import { ScanUpload } from "./scan-upload";

export const metadata: Metadata = { title: "Scan a meal" };

export default function Page() {
  return <ScanUpload />;
}
