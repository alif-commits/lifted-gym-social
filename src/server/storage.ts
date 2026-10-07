import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { del as blobDel, get as blobGet, put as blobPut } from "@vercel/blob";
import { config } from "@/server/config";

export type StoredObject = { stream: ReadableStream<Uint8Array>; contentType: string; size: number | null; etag: string | null };

export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  getBuffer(key: string): Promise<Buffer | null>;
  delete(keys: string[]): Promise<void>;
}

/** Vercel Blob (private store). Objects are only ever served through our authorised media route. */
class VercelBlobStorage implements ObjectStorage {
  async put(key: string, body: Buffer, contentType: string) {
    await blobPut(key, body, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true });
  }
  async get(key: string): Promise<StoredObject | null> {
    const res = await blobGet(key, { access: "private" });
    if (!res || res.statusCode !== 200) return null;
    return { stream: res.stream, contentType: res.blob.contentType, size: res.blob.size, etag: res.blob.etag };
  }
  async getBuffer(key: string) {
    const obj = await this.get(key);
    return obj ? Buffer.from(await new Response(obj.stream).arrayBuffer()) : null;
  }
  async delete(keys: string[]) {
    if (keys.length) await blobDel(keys);
  }
}

const LOCAL_ROOT = path.join(process.cwd(), ".data", "uploads");
const MIME_BY_EXT: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".json": "application/json",
  ".csv": "text/csv",
  ".zip": "application/zip",
};

/** Development fallback so the app works without a Blob token. Never used in production. */
class LocalDiskStorage implements ObjectStorage {
  private resolve(key: string) {
    const full = path.join(LOCAL_ROOT, key);
    if (!full.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Invalid storage key");
    return full;
  }
  async put(key: string, body: Buffer) {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
  }
  async get(key: string): Promise<StoredObject | null> {
    const file = this.resolve(key);
    try {
      const info = await stat(file);
      const { createReadStream } = await import("node:fs");
      return {
        stream: Readable.toWeb(createReadStream(file)) as unknown as ReadableStream<Uint8Array>,
        contentType: MIME_BY_EXT[path.extname(file)] ?? "application/octet-stream",
        size: info.size,
        etag: `"${info.size}-${info.mtimeMs}"`,
      };
    } catch {
      return null;
    }
  }
  async getBuffer(key: string) {
    try {
      return await readFile(this.resolve(key));
    } catch {
      return null;
    }
  }
  async delete(keys: string[]) {
    await Promise.all(keys.map((k) => rm(this.resolve(k), { force: true })));
  }
}

let instance: ObjectStorage | null = null;
export function getStorage(): ObjectStorage {
  if (!instance) {
    if (config.blobConfigured) instance = new VercelBlobStorage();
    else if (config.isProd) throw new Error("Object storage is not configured (set BLOB_READ_WRITE_TOKEN)");
    else instance = new LocalDiskStorage();
  }
  return instance;
}

/** Public URL (served through the authorised media route) for a storage key. */
export function mediaUrl(key: string | null | undefined): string | null {
  return key ? `/api/v1/media/${key}` : null;
}
