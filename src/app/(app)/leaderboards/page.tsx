import type { Metadata } from "next";
import { LeaderboardsView } from "./leaderboards-view";

export const metadata: Metadata = { title: "Friends" };

export default function Page() {
  return <LeaderboardsView />;
}
