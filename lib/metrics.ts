// v0.2.0 phase G+ — lightweight product metrics.
//
// Emits structured single-line logs prefixed `[metric]` so they're
// trivially greppable in Vercel's function logs. No new database
// table, no third-party SDK, no client-side bundle weight beyond a
// fetch call. When we later want a real analytics store (Supabase
// table, PostHog, etc.) the call sites stay the same — only the
// transport in this file changes.
//
// Design notes:
// - Email is hashed (SHA-256, first 12 hex chars) before logging
//   so PII never lands in plain log output. Same email always
//   hashes to the same id, so cohort + funnel analysis still works.
// - Props are flattened to key=value pairs (numbers, booleans, and
//   short strings only). Anything else is JSON.stringify'd, which
//   is rare in metric payloads.
// - Always fire-and-forget. A failure here must NEVER block a real
//   request; the catch swallows everything.

import { createHash } from "node:crypto";

export type MetricKind =
  // Duel funnel
  | "duel_started"
  | "duel_completed"
  | "duel_abandoned"
  | "duel_winner_picked"
  | "duel_pinned_prompt_fired"
  | "duel_retry_both"
  | "duel_upsell_shown"
  | "duel_upsell_dismissed"
  // Monetization funnel
  | "upgrade_clicked"
  | "limit_hit"
  | "credits_used"
  | "boost_consumed"
  // Generic
  | "client_event";

type PrimitiveProp = string | number | boolean | null | undefined;
export type MetricProps = Record<string, PrimitiveProp>;

function hashEmail(email: string | null | undefined): string {
  if (!email) return "anon";
  const normalized = email.trim().toLowerCase();
  if (!normalized) return "anon";
  return createHash("sha256").update(normalized).digest("hex").slice(0, 12);
}

function formatProps(props: MetricProps | undefined): string {
  if (!props) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    let v: string;
    if (typeof value === "string") {
      // Trim aggressive whitespace + cap length so a long prompt
      // doesn't bloat the log line. Strip newlines / pipes that
      // would break the structured format.
      v = value.replace(/[\n\r|]/g, " ").slice(0, 120);
    } else {
      v = String(value);
    }
    parts.push(`${key}=${v}`);
  }
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

export function recordMetric(args: {
  kind: MetricKind;
  email?: string | null;
  surface?: "web" | "desktop";
  props?: MetricProps;
}): void {
  try {
    const userId = hashEmail(args.email);
    const surface = args.surface ?? "web";
    const propsStr = formatProps(args.props);
    // Single-line, key=value structured. Easy to grep:
    //   vercel logs --filter "[metric] kind=duel_started"
    console.log(
      `[metric] kind=${args.kind} user=${userId} surface=${surface}${propsStr}`,
    );
  } catch {
    // Never let metrics throw upstream.
  }
}
