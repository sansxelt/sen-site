// Outbound webhook delivery: when a verification run finalizes, POST the launch decision to the webhook
// endpoints an application has connected. This is the first OUTPUT connection — every other connection tells
// Vraelis about the app; this one tells the owner's systems what Vraelis found.
//
// Safety rules, all non-negotiable because the destination URL is USER-SUPPLIED:
//   - safeFetch only (https, public IPs, DNS-pinned) so a webhook URL can never be used to reach an internal
//     address; the SSRF guard is the whole reason this doesn't use plain fetch
//   - the payload carries ONLY owner-safe facts: decision, counts, ids, a report link. Never a provider
//     session id, storage path, signed URL, token, credential, lease or billing field
//   - signed with HMAC-SHA256 so a receiver can verify the call really came from Vraelis
//   - hard timeout, and completely fail-soft: a dead endpoint must never affect a completed run
import { createHmac } from "crypto";
import { safeFetch, unsafeHttpsUrlReason } from "../safe-fetch";
import { toPublicDecision, type PublicDecision } from "./public-decision";

const TIMEOUT_MS = 8000;
const MAX_ENDPOINTS = 5; // a run notifies at most this many endpoints

export type VerificationWebhookPayload = {
  event: "verification.completed";
  run_id: string;
  application_id: string;
  decision: PublicDecision;         // verified | failed | blocked — the stable PUBLIC vocabulary, NEVER an internal run decision
  flows_total: number;
  flows_passed: number;
  deployment_url: string | null;
  completed_at: string;             // ISO
  report_url: string | null;
};

// Sign the exact bytes we send, so a receiver can recompute over the raw body. Returns null when no signing
// key is configured (the delivery still goes out, just unsigned — the receiver can fall back to a secret path).
function sign(body: string, timestamp: string): string | null {
  const key = process.env.VRAELIS_SECRET_KEY;
  if (!key) return null;
  return createHmac("sha256", key).update(`${timestamp}.${body}`).digest("hex");
}

// Slack incoming webhooks take Slack's own message shape, not our JSON, so a Slack endpoint gets a formatted
// message instead of the raw payload. Same owner-safe facts, just rendered for humans in a channel.
const DECISION_TEXT: Record<string, { emoji: string; label: string }> = {
  verified: { emoji: ":white_check_mark:", label: "VERIFIED" },
  failed: { emoji: ":no_entry:", label: "FAILED" },
  blocked: { emoji: ":warning:", label: "BLOCKED" },
};
export function buildSlackMessage(p: VerificationWebhookPayload): Record<string, unknown> {
  const d = DECISION_TEXT[p.decision] ?? { emoji: ":grey_question:", label: p.decision.toUpperCase() };
  const lines = [
    `*${d.label}* — ${p.flows_passed}/${p.flows_total} flows passed`,
    p.deployment_url ? `<${p.deployment_url}|${p.deployment_url}>` : null,
  ].filter(Boolean).join("\n");
  return {
    text: `${d.emoji} Vraelis: ${d.label} (${p.flows_passed}/${p.flows_total} flows)`,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `${d.emoji} ${lines}` } },
      ...(p.report_url
        ? [{ type: "context", elements: [{ type: "mrkdwn", text: `<${p.report_url}|View the evidence>` }] }]
        : []),
    ],
  };
}

function isSlackEndpoint(url: string): boolean {
  try { return new URL(url).hostname.endsWith("hooks.slack.com"); } catch { return false; }
}

// Deliver one payload to one endpoint. Never throws; returns whether it was accepted (2xx). A Slack incoming
// webhook gets Slack's message format; everything else gets the signed JSON payload.
export async function deliverWebhook(url: string, payload: VerificationWebhookPayload): Promise<boolean> {
  if (isSlackEndpoint(url)) return deliverSlack(url, payload);
  return deliverJson(url, payload);
}

async function deliverSlack(url: string, payload: VerificationWebhookPayload): Promise<boolean> {
  if (unsafeHttpsUrlReason(url)) return false;
  try {
    const res = await safeFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "vraelis-webhook/1" },
      body: JSON.stringify(buildSlackMessage(payload)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function deliverJson(url: string, payload: VerificationWebhookPayload): Promise<boolean> {
  // Re-validate at send time: the URL was checked when stored, but storage and delivery are far apart.
  if (unsafeHttpsUrlReason(url)) return false;
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = sign(body, timestamp);
  try {
    const res = await safeFetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "vraelis-webhook/1",
        "x-vraelis-event": payload.event,
        "x-vraelis-timestamp": timestamp,
        ...(signature ? { "x-vraelis-signature": `sha256=${signature}` } : {}),
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false; // unreachable, blocked, timed out — never surfaces to the run
  }
}

// Deliver to every endpoint for a run. Fail-soft and bounded; returns how many accepted.
export async function dispatchVerificationWebhooks(
  urls: string[],
  payload: VerificationWebhookPayload,
): Promise<number> {
  const targets = Array.from(new Set(urls.filter((u) => typeof u === "string" && u.trim()))).slice(0, MAX_ENDPOINTS);
  if (!targets.length) return 0;
  const results = await Promise.all(targets.map((u) => deliverWebhook(u.trim(), payload)));
  return results.filter(Boolean).length;
}

// Build the owner-safe payload. Kept pure + exported so it can be asserted in tests: anything not listed here
// must never reach a third-party endpoint.
export function buildVerificationPayload(input: {
  runId: string;
  applicationId: string;
  decision: string | null;          // the INTERNAL run decision (ready | needs_review | blocked | repair_verified) or null
  runState?: string;                // defaults to "completed": the webhook only fires once a run has finalized
  flowsTotal: number;
  flowsPassed: number;
  deploymentUrl?: string | null;
  appBaseUrl?: string | null;
}): VerificationWebhookPayload {
  // Map to the stable PUBLIC decision at this single choke point, so no internal decision word (ready /
  // needs_review / repair_verified / internal "blocked") can ever reach a third-party endpoint. A finalized
  // run with no verdict is "blocked" (toPublicDecision only returns null for a not-yet-final run).
  const decision = toPublicDecision(input.runState ?? "completed", input.decision) ?? "blocked";
  return {
    event: "verification.completed",
    run_id: input.runId,
    application_id: input.applicationId,
    decision,
    flows_total: input.flowsTotal,
    flows_passed: input.flowsPassed,
    deployment_url: input.deploymentUrl ?? null,
    completed_at: new Date().toISOString(),
    report_url: input.appBaseUrl
      ? `${input.appBaseUrl}/systems/${input.applicationId}/passes/${input.runId}`
      : null,
  };
}
