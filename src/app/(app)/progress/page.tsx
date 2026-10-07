import type { Metadata } from "next";
import { Suspense } from "react";
import { ProgressView } from "./progress-view";

export const metadata: Metadata = { title: "Progress" };

export default function Page() {
  return (
    <Suspense>
      <ProgressView />
    </Suspense>
  );
}
