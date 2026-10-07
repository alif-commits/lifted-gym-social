export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "RESOURCE_NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "EMAIL_NOT_VERIFIED"
  | (string & {});

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, code: ErrorCode = "BAD_REQUEST", details?: unknown) =>
  new ApiError(400, code, message, details);
export const unauthenticated = (message = "Please sign in to continue") => new ApiError(401, "UNAUTHENTICATED", message);
export const forbidden = (message = "You don't have access to this resource") => new ApiError(403, "FORBIDDEN", message);
export const notFound = (what = "Resource") => new ApiError(404, "RESOURCE_NOT_FOUND", `${what} not found`);
export const conflict = (message: string, code: ErrorCode = "CONFLICT") => new ApiError(409, code, message);
export const rateLimited = (retryAfterSeconds: number) =>
  new ApiError(429, "RATE_LIMITED", "Too many requests. Please try again shortly.", undefined, {
    "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))),
  });
