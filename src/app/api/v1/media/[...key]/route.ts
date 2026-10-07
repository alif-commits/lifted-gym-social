import { NextResponse } from "next/server";
import { getSession } from "@/server/auth/session";
import { ApiError } from "@/server/http/errors";
import { isPrivatePrefix, openMedia } from "@/server/services/media";

/** Authorised media delivery. Private objects are never cached by shared caches. */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  try {
    const { key } = await ctx.params;
    const path = key.map(decodeURIComponent).join("/");
    const session = await getSession();
    const obj = await openMedia(session?.user ?? null, path);
    const privateObj = isPrivatePrefix(path);
    return new Response(obj.stream, {
      headers: {
        "Content-Type": obj.contentType,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        // Keys are content-addressed (random suffix) so a long browser cache is safe; private data stays out of shared caches.
        "Cache-Control": privateObj ? "private, max-age=3600" : "public, max-age=86400, stale-while-revalidate=604800",
        ...(obj.size ? { "Content-Length": String(obj.size) } : {}),
      },
    });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ success: false, error: { code: e.code, message: e.message } }, { status: e.status });
    console.error(`[media] ${(e as Error).message}`);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 });
  }
}
