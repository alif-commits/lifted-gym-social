import type { Metadata } from "next";
import { ScanReview } from "./scan-review";

export const metadata: Metadata = { title: "Review scan" };

export default async function Page({ params }: PageProps<"/nutrition/scan/[id]">) {
  const { id } = await params;
  return <ScanReview id={id} />;
}
