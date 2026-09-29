// Webhook signature verification. Vraelis signs each delivery as:
//   X-Vraelis-Signature: sha256=HMAC_SHA256(secret, `${timestamp}.${rawBody}`)
//   X-Vraelis-Timestamp: <unix seconds>
// Verify with the RAW request body (not a re-serialized object) and the headers.

import { createHmac, timingSafeEqual } from "crypto";

export interface VerifyWebhookOptions {
  /** The raw request body string, exactly as received. */
  payload: string;
  /** The X-Vraelis-Signature header value (e.g. "sha256=abc…"). */
  signature: string | null | undefined;
  /** The X-Vraelis-Timestamp header value (unix seconds). */
  timestamp: string | null | undefined;
  /** Your endpoint's signing secret. */
  secret: string;
  /** If set (> 0), reject deliveries whose timestamp is older/newer than this many seconds (replay protection). */
  toleranceSeconds?: number;
}

/**
 * Returns true only if the signature is valid (constant-time compare). Returns
 * false for any missing field, malformed signature, or (when toleranceSeconds is
 * set) a stale timestamp. Never throws.
 */
export function verifyWebhookSignature(opts: VerifyWebhookOptions): boolean {
  const { payload, signature, timestamp, secret, toleranceSeconds } = opts;
  if (!payload || !signature || !timestamp || !secret) return false;

  if (typeof toleranceSeconds === "number" && toleranceSeconds > 0) {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return false;
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > toleranceSeconds) return false;
  }

  const expected = "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** The body of a `verification.completed` delivery, sent once when a verification finishes. */
export interface VraelisWebhookEvent {
  event: "verification.completed";
  /** The raw run id. The API's verification id for it is `vrf_${run_id}`. */
  run_id: string;
  application_id: string;
  decision: "verified" | "failed" | "blocked";
  flows_total: number;
  flows_passed: number;
  deployment_url: string | null;
  /** ISO timestamp. */
  completed_at: string;
  /** Where a person opens the full record, or null. */
  report_url: string | null;
  /** Unique per delivery; also sent as the X-Vraelis-Delivery header. */
  delivery_id?: string;
  /** True on a sample delivery sent from the dashboard. */
  test_event?: boolean;
}
