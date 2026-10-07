import type { Metadata } from "next";
import { HistoryView } from "./history-view";

export const metadata: Metadata = { title: "Workouts" };

export default function Page() {
  return <HistoryView />;
}
