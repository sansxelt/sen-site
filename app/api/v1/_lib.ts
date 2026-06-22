// Shared helpers for the public /api/v1/* surface: a standard error shape and a
// request id. The error envelope is consistent for every endpoint so clients can
// branch on a stable `error.code`. Never leak secrets or stack traces.

import { randomBytes } from "crypto";

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "insufficient_credits"
  | "rate_limited"
  | "internal_error";

export function requestId(): string {
  return "req_" + randomBytes(8).toString("hex");
}

export function apiError(code: ApiErrorCode, message: string, status: number, rid?: string, extraHeaders?: Record<string, string>): Response {
  const id = rid ?? requestId();
  return Response.json(
    { error: { code, message, request_id: id } },
    { status, headers: { "X-Request-Id": id, ...(extraHeaders ?? {}) } },
  );
}
