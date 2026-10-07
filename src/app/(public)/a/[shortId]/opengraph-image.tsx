import { ImageResponse } from "next/og";
import { SHARE_OG_SIZE } from "@/lib/share-card";
import { GenericOgCard, WorkoutOgCard } from "@/server/share/workout-card";
import { getWorkoutShareView } from "@/server/services/share-card";

export const alt = "LIFTED workout";
export const size = SHARE_OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ shortId: string }> }) {
  const { shortId } = await params;
  try {
    const view = await getWorkoutShareView(null, shortId);
    if (!view.isPublic) return new ImageResponse(<GenericOgCard />, size);
    return new ImageResponse(<WorkoutOgCard card={view} />, size);
  } catch {
    return new ImageResponse(<GenericOgCard />, size);
  }
}
