// Redaction for logs, provider metadata, and stored evidence. The worker touches untrusted apps + test
// credentials, so NOTHING sensitive may reach logs or artifacts: auth headers, cookies, tokens, API keys,
// signed URLs, request bodies, and emails are stripped. Deterministic + pure.
import type { LogFields } from "./types";

const SECRET_KEY = /(authorization|cookie|set-cookie|token|secret|api[-_]?key|password|bearer|session|signature)/i;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const SIGNED_URL_QS = /([?&](?:token|signature|sig|x-amz-[a-z-]+|se|sp|sv|sr)=)[^&\s]+/gi;

export function redactString(s: string): string {
  return (s || "")
    .replace(SIGNED_URL_QS, "$1[redacted]")
    .replace(EMAIL, "[email]")
    .slice(0, 2000);
}

// Reduce a URL to method + path (drop query entirely — it may carry secrets). For network summaries.
export function safePath(rawUrl: string): string {
  try { const u = new URL(rawUrl); return u.pathname || "/"; } catch { return "/"; }
}

// Strip secret-ish keys from an object (one level deep is enough for our metadata shapes).
export function redactObject(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o || {})) {
    if (SECRET_KEY.test(k)) { out[k] = "[redacted]"; continue; }
    out[k] = typeof v === "string" ? redactString(v) : v;
  }
  return out;
}

// Structured, single-line worker log. Every line carries the worker id; values are redacted. Never pass
// credentials, cookies, bodies, keys, or signed URLs in here.
export function log(fields: LogFields): void {
  const safe = redactObject(fields as unknown as Record<string, unknown>);
  // Stable key order for greppable logs.
  console.log(JSON.stringify({ ts: undefined, ...safe }));
}
