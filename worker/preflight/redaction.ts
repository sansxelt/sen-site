// Redaction for logs, provider metadata, and stored evidence. The worker touches untrusted apps + test
// credentials, so NOTHING sensitive may reach logs or artifacts: auth headers, cookies, tokens, API keys,
// signed URLs, request bodies, and emails are stripped. Deterministic + pure.
//
// S6 hardening: during an authenticated flow the executor registers the ACTIVE credential values (the
// resolved username AND password of the account currently signed in) via setActiveCredentials(). While
// registered, redactString scrubs those exact literal values from every string it touches — step detail,
// log fields, console/network evidence — before any of it is persisted. The values live ONLY in worker
// process memory. Registration lasts for the REST OF THE FLOW after a sign-in — NOT just the synchronous
// sign-in call — because Playwright delivers console events asynchronously, so a password an app reflects
// into the console right after submit can surface AFTER the sign-in returns; the executor clears the run's
// set in its per-flow finally (after that flow's last observation is persisted) and again at run teardown.
// This is a defense in depth: the executor never deliberately puts a credential into an observation, and
// this guarantees that even an accidental echo (an app that reflects the username in an error banner, say)
// is scrubbed at the sink. Credentials are scoped per run (see setActiveCredentials) so concurrent runs
// cannot leak into or clear one another.
import type { LogFields } from "./types";

// email/username families, token/secret/key families, session/signature, AND the credential-carrying
// values a login step would type. authorization/bearer are matched so a header key trips redactObject.
const SECRET_KEY = /(authorization|cookie|set-cookie|token|secret|api[-_]?key|password|passwd|pwd|bearer|session|signature|credential|username|user_name|email)/i;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const SIGNED_URL_QS = /([?&](?:token|signature|sig|x-amz-[a-z-]+|se|sp|sv|sr)=)[^&\s]+/gi;
// Credential-shaped VALUES in free text: bearer/basic auth headers, cookies, and well-known token formats.
const CREDENTIAL_VALUE = /\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}|(sk|rk)_(live|test)_[A-Za-z0-9]{8,}|gh[pousr]_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{5,}/gi;

// ── Active-credential scrubbing (S6): literal values of the account currently in use ──────────────────
// The exact literal strings that must never appear in any persisted output. Scoped PER RUN (S6 fix 3):
// each active run owns its own Set keyed by runId, so concurrent runs (maxConcurrentRuns > 1) can never
// scrub, leak, or clear each other's credentials. redactString scrubs against the UNION of every active
// run's set — a superset is always safe (it only ever redacts MORE), and under the current serialized loop
// there is at most one entry anyway. Callers that do not thread a runId use the shared DEFAULT_SCOPE, which
// preserves the old single-set behaviour for tests and any non-run-scoped caller.
const DEFAULT_SCOPE = "__default__";
const ACTIVE_CREDENTIALS_BY_RUN = new Map<string, string[]>();

// Register the exact plaintext values for a run. Sorted longest-first so a substring value (e.g. a password
// contained in an email local-part) is scrubbed first. An empty/short-only set clears the run's entry.
export function setActiveCredentials(values: string[], runId: string = DEFAULT_SCOPE): void {
  const cleaned = Array.from(new Set(values.filter((v) => typeof v === "string" && v.length >= 3)))
    .sort((a, b) => b.length - a.length);
  if (cleaned.length === 0) ACTIVE_CREDENTIALS_BY_RUN.delete(runId);
  else ACTIVE_CREDENTIALS_BY_RUN.set(runId, cleaned);
}
// Add MORE values to a run's set without dropping the ones already registered (used by switch_role so the
// new role's creds join the prior role's — both stay scrubbed until the flow that used them ends).
export function addActiveCredentials(values: string[], runId: string = DEFAULT_SCOPE): void {
  const existing = ACTIVE_CREDENTIALS_BY_RUN.get(runId) ?? [];
  setActiveCredentials([...existing, ...values], runId);
}
export function clearActiveCredentials(runId: string = DEFAULT_SCOPE): void { ACTIVE_CREDENTIALS_BY_RUN.delete(runId); }
// Clear EVERY run's credentials (run-teardown belt-and-suspenders; also resets global test state).
export function clearAllActiveCredentials(): void { ACTIVE_CREDENTIALS_BY_RUN.clear(); }
// Test-only introspection: how many active values are registered for a scope (never returns the values).
export function activeCredentialCount(runId: string = DEFAULT_SCOPE): number { return (ACTIVE_CREDENTIALS_BY_RUN.get(runId) ?? []).length; }

function scrubActiveCredentials(s: string): string {
  if (ACTIVE_CREDENTIALS_BY_RUN.size === 0) return s;
  let out = s;
  // Scrub against the union of EVERY active run's values. A superset is always safe — it can only redact
  // more, never a real credential less — so this is correct under concurrency and cheap under serialization.
  for (const values of ACTIVE_CREDENTIALS_BY_RUN.values()) {
    for (const v of values) {
      if (!v) continue;
      // Global literal replacement (value may appear more than once); split/join avoids regex-escaping.
      if (out.includes(v)) out = out.split(v).join("[redacted-credential]");
    }
  }
  return out;
}

export function redactString(s: string): string {
  return scrubActiveCredentials(s || "")
    .replace(CREDENTIAL_VALUE, "[redacted]")
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
