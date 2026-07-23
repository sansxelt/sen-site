// Tests for outbound verification webhooks (lib/preflight/webhook-dispatch.ts). The endpoint URL is
// USER-SUPPLIED and third-party, so the invariants that matter are: the payload carries only owner-safe
// facts (never a token/credential/session/storage path), and delivery is fail-soft + SSRF-guarded.
// No network: unreachable hosts are expected to fail closed.

process.env.VRAELIS_SECRET_KEY = process.env.VRAELIS_SECRET_KEY || "a".repeat(64);
import { buildVerificationPayload, deliverWebhook, dispatchVerificationWebhooks, buildSlackMessage } from "../lib/preflight/webhook-dispatch";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

// The builder takes the INTERNAL run decision and emits the stable PUBLIC decision (verified|failed|blocked).
// Internal "blocked" (a confirmed critical failure) maps to public "failed".
const payload = buildVerificationPayload({
  runId: "run-1", applicationId: "app-1", decision: "blocked",
  flowsTotal: 3, flowsPassed: 2, deploymentUrl: "https://demo.example.com",
  appBaseUrl: "https://app.vraelis.com",
});

ok("payload carries the mapped public decision + counts + ids",
  payload.event === "verification.completed" && payload.decision === "failed" &&
  payload.flows_total === 3 && payload.flows_passed === 2 &&
  payload.run_id === "run-1" && payload.application_id === "app-1");

// The PUBLIC decision vocabulary is exactly {verified, failed, blocked}; no internal run decision may leak.
const mapDecision = (d: string | null) =>
  buildVerificationPayload({ runId: "r", applicationId: "a", decision: d, flowsTotal: 0, flowsPassed: 0 }).decision;
ok("internal ready -> public verified", mapDecision("ready") === "verified");
ok("internal blocked -> public failed", mapDecision("blocked") === "failed");
ok("internal needs_review -> public blocked", mapDecision("needs_review") === "blocked");
ok("internal repair_verified -> public blocked (no false pass)", mapDecision("repair_verified") === "blocked");
ok("a null decision -> public blocked", mapDecision(null) === "blocked");
ok("no internal decision word ever leaks as the public decision",
  ["ready", "needs_review", "repair_verified"].every((d) => !["ready", "needs_review", "repair_verified"].includes(mapDecision(d) as string)));

ok("payload links to the run report", payload.report_url === "https://app.vraelis.com/applications/app-1/passes/run-1");
ok("report_url is null when no base url is known", buildVerificationPayload({ runId: "r", applicationId: "a", decision: "ready", flowsTotal: 0, flowsPassed: 0 }).report_url === null);

// THE invariant: nothing secret or internal may ever reach a third-party endpoint.
const FORBIDDEN = ["token", "secret", "credential", "password", "encrypted", "storage_path", "signed",
  "session", "lease", "provider_session", "cookie", "authorization", "credits", "held", "failure_message"];
const serialized = JSON.stringify(payload).toLowerCase();
ok("payload contains NO secret/internal field names",
  FORBIDDEN.every((k) => !Object.keys(payload).some((f) => f.toLowerCase().includes(k))));
ok("serialized payload leaks no secret-shaped keys",
  !/"(access_token|refresh_token|encrypted_ref|storage_path|provider_session_id|lease_owner|credits_held)"/.test(serialized));
ok("payload key set is exactly the owner-safe allowlist",
  JSON.stringify(Object.keys(payload).sort()) === JSON.stringify(
    ["application_id", "completed_at", "decision", "deployment_url", "event", "flows_passed", "flows_total", "report_url", "run_id"]));

// Slack gets Slack's own message shape (a raw JSON payload would render as gibberish in a channel), but
// carries exactly the same owner-safe facts — never anything extra.
const slack = buildSlackMessage(payload);
ok("slack message has a text fallback naming the decision",
  typeof slack.text === "string" && (slack.text as string).includes("FAILED") && (slack.text as string).includes("2/3"));
ok("slack message uses blocks with the deployment + report link",
  Array.isArray(slack.blocks) && JSON.stringify(slack.blocks).includes("demo.example.com") &&
  JSON.stringify(slack.blocks).includes("/passes/run-1"));
ok("slack message leaks no secret-shaped keys",
  !/(access_token|refresh_token|encrypted_ref|storage_path|provider_session_id)/i.test(JSON.stringify(slack)));
ok("an unknown decision still renders (no crash, label falls back)",
  typeof buildSlackMessage({ ...payload, decision: "weird_new_state" as never }).text === "string");

// Delivery is fail-soft + SSRF-guarded: private/loopback/non-https targets are refused, never attempted.
(async () => {
  ok("http (non-https) endpoint is refused", (await deliverWebhook("http://example.com/hook", payload)) === false);
  ok("loopback endpoint is refused", (await deliverWebhook("https://127.0.0.1/hook", payload)) === false);
  ok("private-range endpoint is refused", (await deliverWebhook("https://10.0.0.5/hook", payload)) === false);
  ok("garbage url never throws, returns false", (await deliverWebhook("not-a-url", payload)) === false);
  ok("no endpoints -> zero delivered, no throw", (await dispatchVerificationWebhooks([], payload)) === 0);
  ok("blank/duplicate endpoints are filtered", (await dispatchVerificationWebhooks(["", "   "], payload)) === 0);

  console.log(`\n${pass}/${pass + fail} passed`);
  if (fail > 0) process.exit(1);
})();
