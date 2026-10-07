import { badRequest } from "@/server/http/errors";

export function encodeCursor(value: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor<T extends Record<string, string | number>>(cursor: string | undefined): T | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as T;
  } catch {
    throw badRequest("Invalid cursor", "INVALID_CURSOR");
  }
}

export type Page<T> = { items: T[]; next_cursor: string | null };
