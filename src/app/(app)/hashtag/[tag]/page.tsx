import type { Metadata } from "next";
import { HashtagView } from "./hashtag-view";

export async function generateMetadata({ params }: PageProps<"/hashtag/[tag]">): Promise<Metadata> {
  const { tag } = await params;
  return { title: `#${decodeURIComponent(tag)}` };
}

export default async function HashtagPage({ params }: PageProps<"/hashtag/[tag]">) {
  const { tag } = await params;
  return <HashtagView tag={decodeURIComponent(tag).toLowerCase()} />;
}
