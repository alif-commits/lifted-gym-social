import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import { enforceRateLimit, type RateLimitRule } from "@/server/auth/rate-limit";
import { getSession, requestMeta, type SessionUser } from "@/server/auth/session";
import { ApiError, forbidden, unauthenticated } from "./errors";

type Params = Record<string, string | string[]>;
type RouteCtx = { params: Promise<Params> };

export type HandlerContext<U extends SessionUser | null> = {
  req: NextRequest;
  user: U;
  sessionId: string | null;
  params: Params;
  requestId: string;
  ip: string;
};

type Options = {
  /** Rate limit rules evaluated before the handler runs. Keys may include `{ip}` and `{user}` tokens. */
  rateLimit?: RateLimitRule[];
  /** Restrict to roles (implies authentication). */
  roles?: string[];
};

export function json<T>(data: T, status = 200, headers?: Record<string, string>) {
  return NextResponse.json({ success: true, data }, { status, headers });
}
export const created = <T>(data: T) => json(data, 201);
export const noContent = () => new NextResponse(null, { status: 204 });

function errorResponse(err: unknown, requestId: string) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { success: false, error: { code: err.code, message: err.message, details: err.details, requestId } },
      { status: err.status, headers: err.headers },
    );
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      (fields[key] ??= []).push(issue.message);
    }
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Some fields are invalid", details: fields, requestId } },
      { status: 422 },
    );
  }
  const pgCode = (err as { code?: string } | null)?.code;
  if (pgCode === "23505") {
    return NextResponse.json(
      { success: false, error: { code: "CONFLICT", message: "This record already exists", requestId } },
      { status: 409 },
    );
  }
  // Never expose internals. Log only the error name/message (no payloads, no secrets).
  const e = err as Error;
  console.error(`[api] ${requestId} unhandled ${e?.name}: ${e?.message}`);
  return NextResponse.json(
    { success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong", requestId } },
    { status: 500 },
  );
}

/** Reject cross-site state-changing requests (defence in depth on top of SameSite=Lax). */
function assertSameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw forbidden("Cross-origin request blocked");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw forbidden("Invalid origin");
  }
}

function expand(rule: RateLimitRule, ip: string, userId: string | null): RateLimitRule {
  return { ...rule, key: rule.key.replace("{ip}", ip).replace("{user}", userId ?? "anon") };
}

function build<U extends SessionUser | null>(
  mode: "required" | "optional" | "none",
  fn: (c: HandlerContext<U>) => Promise<Response | unknown>,
  opts: Options = {},
) {
  return async (req: NextRequest, ctx?: RouteCtx): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const started = Date.now();
    let status = 200;
    try {
      assertSameOrigin(req);
      const { ip } = await requestMeta();
      const session = mode === "none" ? null : await getSession();
      if (mode === "required" && !session) throw unauthenticated();
      if (opts.roles && (!session || !opts.roles.includes(session.user.role))) throw forbidden();
      for (const rule of opts.rateLimit ?? []) await enforceRateLimit(expand(rule, ip, session?.user.id ?? null));

      const params = ctx?.params ? await ctx.params : {};
      const result = await fn({
        req,
        user: (session?.user ?? null) as U,
        sessionId: session?.sessionId ?? null,
        params,
        requestId,
        ip,
      });
      const res = result instanceof Response ? result : json(result);
      status = res.status;
      res.headers.set("X-Request-Id", requestId);
      return res;
    } catch (err) {
      const res = errorResponse(err, requestId);
      status = res.status;
      return res;
    } finally {
      // Structured access log: no bodies, tokens or secrets.
      console.info(
        JSON.stringify({ t: "api", id: requestId, m: req.method, p: new URL(req.url).pathname, s: status, ms: Date.now() - started }),
      );
    }
  };
}

export const route = {
  /** Requires an authenticated session. */
  auth: (fn: (c: HandlerContext<SessionUser>) => Promise<Response | unknown>, opts?: Options) =>
    build<SessionUser>("required", fn, opts),
  /** Works for anonymous and authenticated callers. */
  optional: (fn: (c: HandlerContext<SessionUser | null>) => Promise<Response | unknown>, opts?: Options) =>
    build<SessionUser | null>("optional", fn, opts),
  /** Never reads the session. */
  public: (fn: (c: HandlerContext<null>) => Promise<Response | unknown>, opts?: Options) =>
    build<null>("none", fn, opts),
};

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Request body must be valid JSON");
  }
  return schema.parse(raw);
}

/** Like parseBody, but an empty body is treated as `undefined` (for endpoints whose body is optional). */
export async function parseOptionalBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  const text = (await req.text()).trim();
  let raw: unknown;
  if (text) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw new ApiError(400, "BAD_REQUEST", "Request body must be valid JSON");
    }
  }
  return schema.parse(raw);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  const obj: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  return schema.parse(obj);
}
