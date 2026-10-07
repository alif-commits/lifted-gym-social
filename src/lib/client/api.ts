/** Thin typed fetch wrapper for the LIFTED REST API. Server dates arrive as ISO strings. */

export type Serialized<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Array<Serialized<U>>
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;

export type Page<T> = { items: T[]; next_cursor: string | null };

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
  /** First validation message for a field, if any. */
  field(name: string): string | undefined {
    return this.details?.[name]?.[0];
  }
}

type Options = { method?: string; body?: unknown; form?: FormData; signal?: AbortSignal };

export async function api<T = void>(path: string, opts: Options = {}): Promise<T> {
  const init: RequestInit = { method: opts.method ?? (opts.body || opts.form ? "POST" : "GET"), signal: opts.signal, credentials: "same-origin" };
  if (opts.form) init.body = opts.form;
  else if (opts.body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, init);
  } catch {
    throw new ApiClientError(0, "NETWORK", "You appear to be offline. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  let json: { success?: boolean; data?: T; error?: { code: string; message: string; details?: Record<string, string[]> } } | null = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok || !json?.success) {
    throw new ApiClientError(res.status, json?.error?.code ?? "UNKNOWN", json?.error?.message ?? "Something went wrong. Please try again.", json?.error?.details);
  }
  return json.data as T;
}

export const get = <T>(path: string, signal?: AbortSignal) => api<T>(path, { signal });
export const post = <T = void>(path: string, body?: unknown) => api<T>(path, { method: "POST", body: body ?? {} });
export const put = <T = void>(path: string, body?: unknown) => api<T>(path, { method: "PUT", body });
export const patch = <T = void>(path: string, body?: unknown) => api<T>(path, { method: "PATCH", body });
export const del = <T = void>(path: string, body?: unknown) => api<T>(path, { method: "DELETE", body });
export const upload = <T>(path: string, form: FormData) => api<T>(path, { method: "POST", form });

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
