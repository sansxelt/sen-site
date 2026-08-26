// Shared constant-time authorization for the cron routes.
//
// All ten cron routes compared the bearer token with `!==`, which short-circuits on the first differing
// byte. A sibling admin route accepting the SAME secret already used timingSafeEqual, so the codebase
// disagreed with itself about whether this mattered. Over the network the signal is small and noisy, but
// it is free to remove and there is no reason for two comparison standards for one secret.
//
// FAILS CLOSED. An unset or empty CRON_SECRET denies, exactly as the existing routes do — a missing secret
// means the endpoint is closed, never open to everyone.

import { timingSafeEqual } from "node:crypto";

/** Constant-time string equality. Length is compared first because timingSafeEqual throws on a mismatch. */
export function secretsMatch(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/**
 * True when the request carries the correct `Authorization: Bearer <CRON_SECRET>`.
 * Returns false when CRON_SECRET is unset, so an unconfigured deployment closes the endpoint.
 */
export function cronAuthorized(req: { headers: { get(name: string): string | null } }): boolean {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return secretsMatch(header, `Bearer ${secret}`);
}
