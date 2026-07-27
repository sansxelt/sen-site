// Tests for the run-safety controls: the provider error classifier (worker/preflight/provider-errors.ts,
// pure, no DB) plus static source checks that the kill switch and the per-owner daily cap sit BEFORE the
// credit hold in both launch routes, that the report exposes the coarse failure_code, and that the launch
// button shows the credit estimate. Proves the classifier maps every provider failure to a fixed, owner-safe
// enum and NEVER leaks a raw provider message into the code or the user sentence.
import fs from "node:fs";
import { before } from "./_source-order";
import path from "node:path";
import { classifyProviderError, type ProviderErrorCode } from "../worker/preflight/provider-errors";
import { BrowserbaseApiError } from "../worker/preflight/providers/browserbase-api";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

const CODES: ProviderErrorCode[] = ["provider_auth_failed", "provider_quota", "provider_capacity", "provider_unavailable", "infra_misconfigured", "session_timeout", "run_error"];

// ── classifyProviderError: every mapping ──
ok("Browserbase 401 -> provider_auth_failed", classifyProviderError(new BrowserbaseApiError(401, "unauthorized")).code === "provider_auth_failed");
ok("Browserbase 403 -> provider_auth_failed", classifyProviderError(new BrowserbaseApiError(403, "forbidden")).code === "provider_auth_failed");
ok("Browserbase 402 -> provider_quota", classifyProviderError(new BrowserbaseApiError(402, "payment required")).code === "provider_quota");
ok("Browserbase 429 -> provider_capacity", classifyProviderError(new BrowserbaseApiError(429, "rate limited")).code === "provider_capacity");
ok("Browserbase 500 -> provider_unavailable", classifyProviderError(new BrowserbaseApiError(500, "boom")).code === "provider_unavailable");
ok("Browserbase 503 -> provider_unavailable", classifyProviderError(new BrowserbaseApiError(503, "maintenance")).code === "provider_unavailable");
ok("playwright_missing -> infra_misconfigured", classifyProviderError(new Error("playwright_missing: install playwright-core on the worker")).code === "infra_misconfigured");
ok("browserbase_bad_response -> infra_misconfigured", classifyProviderError(new Error("browserbase_bad_response: missing id or connectUrl")).code === "infra_misconfigured");
ok("'Timeout ...' -> session_timeout", classifyProviderError(new Error("Timeout 30000ms exceeded.")).code === "session_timeout");
ok("'... timed out' -> session_timeout", classifyProviderError(new Error("connection to the session timed out")).code === "session_timeout");

// ── unknown fallback ──
ok("unknown Error -> run_error", classifyProviderError(new Error("ECONNRESET while reading")).code === "run_error");
ok("Browserbase 404 (unmapped status) -> run_error", classifyProviderError(new BrowserbaseApiError(404, "not found")).code === "run_error");
ok("non-Error string -> run_error", classifyProviderError("boom").code === "run_error");
ok("null -> run_error", classifyProviderError(null).code === "run_error");

// ── no raw message leakage: code is always one of the fixed enum values, and neither the code nor the
// user sentence ever contains the raw provider text ──
{
  const raws = [
    new BrowserbaseApiError(500, "raw-provider-body-XYZZY internal stack"),
    new Error("SECRET-RAW-DETAIL-XYZZY playwright_missing"),
    new Error("SECRET-RAW-DETAIL-XYZZY Timeout 5ms"),
    new Error("SECRET-RAW-DETAIL-XYZZY totally unknown"),
    "SECRET-RAW-DETAIL-XYZZY" as unknown,
  ];
  let enumOnly = true, noLeak = true;
  for (const raw of raws) {
    const r = classifyProviderError(raw);
    if (!CODES.includes(r.code)) enumOnly = false;
    if (r.code.includes("XYZZY") || r.userMessage.includes("XYZZY")) noLeak = false;
  }
  ok("code is ALWAYS one of the fixed enum values", enumOnly);
  ok("raw provider text never leaks into code or userMessage", noLeak);
  ok("every mapping carries a non-empty user sentence", raws.every((raw) => classifyProviderError(raw).userMessage.length > 0));
}

// ── static: both launches gate on the kill switch and the daily cap BEFORE the credit hold ──
//
// The launch is two files now. The route keeps the flag gates and then hands over to the acceptance
// service, which owns the caps and the escrow; the rerun route is still one file, so both halves of it
// point at the same source. "gate" is where the flags are read, "body" is where money is reserved, and
// "handoff" is the call in the gate file that the hold sits behind.
for (const [name, gateFile, bodyFile, handoff] of [
  ["launch", path.join("app", "api", "preflight", "apps", "[id]", "runs", "route.ts"),
    path.join("lib", "preflight", "acceptance", "accept-run.ts"), "await acceptVerificationRun("],
  ["rerun route", path.join("app", "api", "preflight", "runs", "[runId]", "rerun", "route.ts"),
    path.join("app", "api", "preflight", "runs", "[runId]", "rerun", "route.ts"), "await hold("],
] as const) {
  const gate = read(gateFile);
  const src = read(bodyFile);
  const iEnabled = gate.indexOf("preflightEnabled()");
  const iKill = gate.indexOf("runsDisabled()");
  const iDaily = src.indexOf("ownerRunsToday(");
  const iHold = src.indexOf("await hold(");
  ok(`${name}: kill switch check exists, right after the preflight flag gate`, iKill > iEnabled && iEnabled >= 0 && iKill >= 0);
  ok(`${name}: kill switch returns 503 runs_paused`, /runs_paused[\s\S]{0,220}status:\s*503/.test(gate));
  // Stated as two facts rather than one offset comparison, because the two ends are in different files when
  // the launch is extracted: nothing is reserved before the handover, and the kill switch precedes it.
  // When the two are the same file the handoff IS the hold, so this is the original comparison unchanged.
  const extracted = gateFile !== bodyFile;
  ok(`${name}: kill switch gated BEFORE the credit hold`,
    before(gate, "runsDisabled()", handoff) && iHold >= 0 && (!extracted || !gate.includes("await hold(")));
  ok(`${name}: daily cap checked BEFORE the credit hold (no hold past the cap)`, iDaily >= 0 && iHold >= 0 && iDaily < iHold);
  ok(`${name}: daily cap returns 429 daily_limit`, /daily_limit[\s\S]{0,220}status:\s*429/.test(src));
  // The cap moved to lib/preflight/limits.ts so the Usage page could show it without becoming a third copy
  // of the number. Asserting the env expression inline would now fail on correct code AND would go back to
  // permitting two routes that disagree; assert the shared source instead.
  ok(`${name}: daily cap comes from the shared limit, not a local literal`,
    /maxRunsPerDay\(\)/.test(src) && !/PREFLIGHT_MAX_RUNS_PER_DAY/.test(src));
  ok(`${name}: concurrency cap comes from the shared limit too`,
    /MAX_ACTIVE_RUNS_PER_OWNER/.test(src) && !/const MAX_ACTIVE_RUNS_PER_OWNER\s*=/.test(src));
}

// ── static: ownerRunsToday is owner-scoped, counts since UTC midnight, degrades to 0 ──
{
  const src = read("lib", "preflight", "runs-db.ts");
  const fn = src.slice(src.indexOf("export async function ownerRunsToday"), src.indexOf("function flowApprovedEnabled"));
  ok("ownerRunsToday: owner-scoped count on v_preflight_runs", /v_preflight_runs/.test(fn) && /eq\("user_id"/.test(fn));
  ok("ownerRunsToday: counts since UTC midnight", /setUTCHours\(0,\s*0,\s*0,\s*0\)/.test(fn) && /gte\("created_at"/.test(fn));
  ok("ownerRunsToday: degrades to 0 on error", /if \(error\) return 0/.test(fn));
}

// ── static: the report read plane exposes failure_code (coarse enum), never failure_message ──
{
  const src = read("lib", "preflight", "runs-db.ts");
  ok("getRun selects failure_code on the run header", /select\("state, decision, summary,[^"]*failure_code[^"]*"\)/.test(src));
  ok("RunHeader type carries failure_code", /failure_code:\s*string\s*\|\s*null/.test(src));
  ok("getRun never selects failure_message (raw text stays server-side)", !/failure_message/.test(src.replace(/\/\/.*$/gm, "")));
}

// ── static: the report page maps the code to a user sentence, keeping the generic line as fallback ──
{
  // (path updated after the shell rename: apps/[id]/runs/[runId] -> applications/[id]/passes/[runId])
  const src = read("app", "rank", "app", "applications", "[id]", "passes", "[runId]", "page.tsx");
  ok("report page has a FAILURE_LINE map covering the classifier codes", ["provider_auth_failed", "provider_quota", "provider_capacity", "provider_unavailable", "infra_misconfigured", "session_timeout"].every((c) => src.includes(c)));
  ok("report page keeps the generic line for unknown/absent codes", src.includes("This verification stopped before it reached a conclusion."));
}

// ── static: the launch button no longer guesses a price (cost comes from the gate-parity PassPreview) ──
{
  // (path updated after the shell rename: apps/[id] -> applications/[id])
  const src = read("app", "rank", "app", "applications", "[id]", "launch-button.tsx");
  // HF1: the old "(N credits)" suffix was the LEGACY model and wrong under pass pricing; it was removed so
  // the button can never show a price that contradicts the actual charge. The authoritative cost is the
  // PassPreview panel (same gate as launch), rendered beside the button on the Overview + Contract tab.
  ok("launch button does NOT append a hardcoded credit count", !/credit\$\{flowIds\.length/.test(src) && !/flowIds\.length[\s\S]{0,40}credit/.test(src));
  ok("cost transparency comes from PassPreview beside the launch button (Overview)",
    read("app", "rank", "app", "applications", "[id]", "page.tsx").includes("<PassPreview"));
  ok("launch button maps runs_paused + daily_limit inline", src.includes("runs_paused") && src.includes("daily_limit"));
}

// ── static: the worker keeps its side of the contract ──
{
  const src = read("worker", "preflight", "execute-run.ts");
  ok("executor classifies non-cancel/non-lease errors via classifyProviderError", /classifyProviderError\(e\)\.code/.test(src));
  ok("executor keeps cancelled / lease_lost codes as-is", /CancelledError \? "cancelled"/.test(src) && /LeaseLostError \? "lease_lost"/.test(src));
  const cfg = read("worker", "preflight", "config.ts");
  ok("worker startup notes the unsafe seed flag and the kill switch", /PREFLIGHT_SEED_ALLOW_PROD === "1"/.test(cfg) && /VRAELIS_RUNS_DISABLED === "1"/.test(cfg));
}

// ONE PLACE HOLDS THE NUMBERS. A page that restates a limit the routes enforce will eventually promise a
// customer a ceiling the API refuses at, which is worse than not showing it at all.
{
  const limits = fs.readFileSync("lib/preflight/limits.ts", "utf8");
  ok("the shared limit module defines the concurrency cap", /export const MAX_ACTIVE_RUNS_PER_OWNER = 2;/.test(limits));
  ok("the shared limit module defaults the daily cap to 20", /PREFLIGHT_MAX_RUNS_PER_DAY \|\| 20/.test(limits));
  ok("a bad env value cannot raise the cap to NaN", /Number\.isFinite\(n\) && n > 0 \? n : 20/.test(limits));
  const usage = fs.readFileSync("app/rank/app/usage/page.tsx", "utf8");
  ok("the Usage page quotes the shared limits rather than its own",
    /from "@\/lib\/preflight\/limits"/.test(usage) && !/= 2;/.test(usage));
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
