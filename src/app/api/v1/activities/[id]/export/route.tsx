import { ImageResponse } from "next/og";
import { z } from "zod";
import { SHARE_STORY_SIZE } from "@/lib/share-card";
import { parseQuery, route } from "@/server/http/handler";
import { jpegToPdf } from "@/server/share/pdf";
import { WorkoutStoryCard } from "@/server/share/workout-card";
import { getWorkoutShareView } from "@/server/services/share-card";

export const runtime = "nodejs";

const query = z.object({ format: z.enum(["png", "jpg", "pdf"]).default("png") });

export const GET = route.optional(
  async ({ req, user, params }) => {
    const { format } = parseQuery(req, query);
    const view = await getWorkoutShareView(user?.id ?? null, String(params.id));
    const image = new ImageResponse(<WorkoutStoryCard card={view} />, { ...SHARE_STORY_SIZE });
    const png = Buffer.from(await image.arrayBuffer());
    const name = `lifted-${view.shortId}`;
    const cache = view.isPublic ? "public, max-age=300" : "private, no-store";

    if (format === "png") {
      return new Response(new Uint8Array(png), {
        headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${name}.png"`, "Cache-Control": cache },
      });
    }

    const sharp = (await import("sharp")).default;
    const jpg = await sharp(png).jpeg({ quality: 88 }).toBuffer();
    if (format === "jpg") {
      return new Response(new Uint8Array(jpg), {
        headers: { "Content-Type": "image/jpeg", "Content-Disposition": `attachment; filename="${name}.jpg"`, "Cache-Control": cache },
      });
    }

    const pdf = jpegToPdf(jpg, SHARE_STORY_SIZE.width, SHARE_STORY_SIZE.height);
    return new Response(new Uint8Array(pdf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"`, "Cache-Control": cache },
    });
  },
  { rateLimit: [{ key: "share-export:ip:{ip}", limit: 40, windowSeconds: 600 }] },
);
