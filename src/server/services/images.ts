import sharp from "sharp";
import { ALLOWED_IMAGE_MIME, MAX_IMAGE_BYTES } from "@/lib/constants";
import { randomToken } from "@/server/lib/ids";
import { badRequest } from "@/server/http/errors";
import { getStorage } from "@/server/storage";
import type { NextRequest } from "next/server";

export type ProcessedImage = { main: Buffer; thumb: Buffer; width: number; height: number; mimeType: string; size: number };

/** Read a single image file from multipart form-data and validate basic constraints. */
export async function readImageUpload(req: NextRequest, field = "file"): Promise<{ buffer: Buffer; form: FormData }> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) throw badRequest("Expected multipart/form-data");
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_IMAGE_BYTES * 1.1) throw badRequest("Image is too large (max 8 MB)", "FILE_TOO_LARGE");
  const form = await req.formData();
  const file = form.get(field);
  if (!(file instanceof File)) throw badRequest("Attach an image file");
  if (file.size === 0) throw badRequest("The file is empty");
  if (file.size > MAX_IMAGE_BYTES) throw badRequest("Image is too large (max 8 MB)", "FILE_TOO_LARGE");
  if (file.type && !(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.type)) {
    throw badRequest("Unsupported image type. Use JPEG, PNG or WebP.", "UNSUPPORTED_MEDIA");
  }
  return { buffer: Buffer.from(await file.arrayBuffer()), form };
}

/**
 * Validate by actually decoding the image (not trusting MIME/extension), strip metadata (EXIF/GPS),
 * auto-orient, and produce an optimised main image plus thumbnail as WebP.
 */
export async function processImage(input: Buffer, opts: { maxEdge?: number; thumbEdge?: number } = {}): Promise<ProcessedImage> {
  const { maxEdge = 1600, thumbEdge = 400 } = opts;
  try {
    const meta = await sharp(input, { failOn: "error", limitInputPixels: 60_000_000 }).metadata();
    if (!meta.width || !meta.height || !["jpeg", "png", "webp"].includes(meta.format ?? "")) {
      throw new Error("unsupported");
    }
    const pipeline = () => sharp(input, { limitInputPixels: 60_000_000 }).rotate();
    const main = await pipeline().resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const thumb = await pipeline().resize({ width: thumbEdge, height: thumbEdge, fit: "cover" }).webp({ quality: 72 }).toBuffer();
    return { main: main.data, thumb, width: main.info.width, height: main.info.height, mimeType: "image/webp", size: main.data.length };
  } catch {
    throw badRequest("We couldn't read that image. Try a different JPEG, PNG or WebP file.", "INVALID_IMAGE");
  }
}

/** Optimise a food photo for the vision model (smaller, JPEG) while keeping detail. */
export async function processFoodImage(input: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  try {
    const out = await sharp(input, { failOn: "error", limitInputPixels: 60_000_000 })
      .rotate()
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { buffer: out.data, width: out.info.width, height: out.info.height };
  } catch {
    throw badRequest("We couldn't read that image. Try a different JPEG, PNG or WebP file.", "INVALID_IMAGE");
  }
}

export async function storeImagePair(prefix: string, processed: ProcessedImage) {
  const id = randomToken(9).replace(/[^a-zA-Z0-9]/g, "x");
  const key = `${prefix}/${id}.webp`;
  const thumbKey = `${prefix}/${id}_thumb.webp`;
  const storage = getStorage();
  await Promise.all([storage.put(key, processed.main, processed.mimeType), storage.put(thumbKey, processed.thumb, processed.mimeType)]);
  return { key, thumbKey };
}
