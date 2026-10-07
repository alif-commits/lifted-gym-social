import type { Metadata } from "next";
import { Calculator } from "./calculator";

export const metadata: Metadata = { title: "Calorie calculator" };

export default function Page() {
  return <Calculator />;
}
