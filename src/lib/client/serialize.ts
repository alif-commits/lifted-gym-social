import type { Serialized } from "./api";

/** Convert server DTOs (Dates etc.) into the plain JSON shape client components receive. */
export const toClient = <T>(value: T): Serialized<T> => JSON.parse(JSON.stringify(value));
