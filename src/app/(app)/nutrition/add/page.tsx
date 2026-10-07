import type { Metadata } from "next";
import { Suspense } from "react";
import { AddFood } from "./add-food";

export const metadata: Metadata = { title: "Add food" };

export default function Page() {
  return (
    <Suspense>
      <AddFood />
    </Suspense>
  );
}
