// Maps a raw worker/provider error to a COARSE, owner-safe failure classification. The `code` is what the
// executor passes to failRun and lands in v_preflight_runs.failure_code, which IS owner-visible on the run
// report, so it must be one of the fixed enum values below and NEVER carry a raw provider string. The
// truncated real message stays in failure_message (server-side only; the report never selects it).
// `userMessage` is the matching plain-English sentence, safe to show anywhere.
import { BrowserbaseApiError } from "./providers/browserbase-api";

export type ProviderErrorCode =
  | "provider_auth_failed"   // provider rejected our credentials (401/403)
  | "provider_quota"         // provider usage allowance exhausted (402)
  | "provider_capacity"      // provider rate/capacity limit (429)
  | "provider_unavailable"   // provider outage (>= 500)
  | "infra_misconfigured"    // our runner is missing a dependency / got a malformed provider response
  | "session_timeout"        // the browser session or a provider call timed out
  | "run_error";             // anything else: a generic, safe catch-all

export type ProviderErrorClass = { code: ProviderErrorCode; userMessage: string };

export function classifyProviderError(e: unknown): ProviderErrorClass {
  if (e instanceof BrowserbaseApiError) {
    if (e.status === 401 || e.status === 403) return { code: "provider_auth_failed", userMessage: "Browser provider authorization failed." };
    if (e.status === 402) return { code: "provider_quota", userMessage: "Browser usage allowance was exhausted." };
    if (e.status === 429) return { code: "provider_capacity", userMessage: "Browser capacity is temporarily unavailable." };
    if (e.status >= 500) return { code: "provider_unavailable", userMessage: "The browser provider had an outage." };
    // Any other provider status (e.g. 400/404) falls through to the generic catch-all below.
  }
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (msg.includes("playwright_missing") || msg.includes("browserbase_bad_response")) {
    return { code: "infra_misconfigured", userMessage: "The run infrastructure is misconfigured." };
  }
  if (/timeout|timed out/i.test(msg)) {
    return { code: "session_timeout", userMessage: "The browser session timed out." };
  }
  return { code: "run_error", userMessage: "The run stopped before it reached a decision." };
}
