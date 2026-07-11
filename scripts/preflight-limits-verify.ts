// Tests for the run-safety controls: the provider error classifier (worker/preflight/provider-errors.ts,
// pure, no DB) plus static source checks that the kill switch and the per-owner daily cap sit BEFORE the
// credit hold in both launch routes, that the report exposes the coarse failure_code, and that the launch
// button shows the credit estimate. Proves the classifier maps every provider failure to a fixed, owner-safe
// enum and NEVER leaks a raw provider message into the code or the user sentence.
import fs from "node:fs";
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

// ── static: both routes gate on the kill switch and the daily cap BEFORE the credit hold ──
for (const [name, file] of [
  ["launch route", path.join("app", "api", "preflight", "apps", "[id]", "runs", "route.ts")],
  ["rerun route", path.join("app", "api", "preflight", "runs", "[runId]", "rerun", "route.ts")],
] as const) {
  const src = read(file);
  const iEnabled = src.indexOf("preflightEnabled()");
  const iKill = src.indexOf("runsDisabled()");
  const iDaily = src.indexOf("ownerRunsToday(");
  const iHold = src.indexOf("await hold(");
  ok(`${name}: kill switch check exists, right after the preflight flag gate`, iKill > iEnabled && iEnabled >= 0 && iKill >= 0);
  ok(`${name}: kill switch returns 503 runs_paused`, /runs_paused[\s\S]{0,220}status:\s*503/.test(src));
  ok(`${name}: kill switch gated BEFORE the credit hold`, iKill >= 0 && iHold >= 0 && iKill < iHold);
  ok(`${name}: daily cap checked BEFORE the credit hold (no hold past the cap)`, iDaily >= 0 && iHold >= 0 && iDaily < iHold);
  ok(`${name}: daily cap returns 429 daily_limit`, /daily_limit[\s\S]{0,220}status:\s*429/.test(src));
  ok(`${name}: daily cap uses PREFLIGHT_MAX_RUNS_PER_DAY with default 20`, /PREFLIGHT_MAX_RUNS_PER_DAY\s*\|\|\s*20/.test(src));
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
  const src = read("app", "rank", "app", "apps", "[id]", "runs", "[runId]", "page.tsx");
  ok("report page has a FAILURE_LINE map covering the classifier codes", ["provider_auth_failed", "provider_quota", "provider_capacity", "provider_unavailable", "infra_misconfigured", "session_timeout"].every((c) => src.includes(c)));
  ok("report page keeps the generic line for unknown/absent codes", src.includes("This run stopped before it reached a decision."));
}

// ── static: the launch button shows the credit estimate + maps the new refusals ──
{
  const src = read("app", "rank", "app", "apps", "[id]", "launch-button.tsx");
  ok("launch button appends the credit estimate from flowIds.length", /flowIds\.length[\s\S]{0,80}credit/.test(src));
  ok("launch button singular/plural credits", /credit\$\{flowIds\.length === 1 \? "" : "s"\}/.test(src));
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

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
