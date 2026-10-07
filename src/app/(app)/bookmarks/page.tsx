import type { Metadata } from "next";
import { BookmarksView } from "./bookmarks-view";

export const metadata: Metadata = { title: "Bookmarks" };

export default function Page() {
  return <BookmarksView />;
}
