// Vraelis Preflight — REAL Browserbase browser-pipeline smoke, STAGED for diagnosis. It runs the actual
// Browserbase flow (create a session, then connectOverCDP to session.connectUrl — the official flow) but
// splits every step into a named stage so a failure is pinned to the exact boundary instead of a generic
// "Connection error". Nothing here is destructive: it only navigates and asserts on an owned fixture.
//
// Stages (in order): environment_loaded, api_reachability, session_creation, cdp_connection,
// fixture_navigation, heading_assertion, screenshot_capture, controlled_failure_capture, browser_close,
// session_release. api_reachability is a FREE, non-mutating projects.list() that confirms the API is
// reachable AND the key is accepted BEFORE the paid session is created — so an auth/transport failure is
// caught without spending a session.
//
// Because it spends real money and starts a real remote browser, it REFUSES to run unless VRAELIS_SMOKE=1
// and requires: BROWSER_PROVIDER=browserbase, BROWSERBASE_API_KEY (the Browserbase project is inferred from
// the key), and PREFLIGHT_SMOKE_URL (an owned, public https fixture, validated by the SSRF string gate
// before any browser is touched). Env is loaded from the repo's .env.local / .env.preflight (loadLocalEnv).
//
// Secrets NEVER reach stdout: the API key, connectUrl, and signing key are never printed, error diagnostics
// are sanitized (name/status/code/request-id/cause only, message run through redactString + key/ws-url
// scrubbing), and a final assertion captures all stdout and confirms no secret leaked. The one intentionally
// failing assertion (controlled_failure_capture) is EXPECTED — it smokes the failure pipeline.
//
// Run: npm run preflight:smoke:browserbase
// Exit codes: 0 = all stages passed; 1 = a stage failed; 2 = precondition not met (gate/creds/url/deps).
import { loadLocalEnv } from "../worker/preflight/local-env";
import { loadWorkerConfig } from "../worker/preflight/config";
import { PlaywrightPreflightPage, safeMetadata } from "../worker/preflight/providers/browserbase";
import { createBrowserbaseSession, releaseBrowserbaseSession } from "../worker/preflight/providers/browserbase-api";
import { unsafeHttpsUrlReason } from "../lib/safe-fetch";
import { redactString } from "../worker/preflight/redaction";

// Load the repo's private local env (.env.local / .env, then .env.preflight) BEFORE any env is read, so
// BROWSERBASE_API_KEY and PREFLIGHT_SMOKE_URL come from the local file — Vercel/Railway env vars are not
// present in a local shell. Secret values are never printed.
loadLocalEnv();

// Variable module names: the worker-only deps are lazily imported so this compiles without them installed.
const BROWSERBASE_PKG = "@browserbasehq/sdk";
const PLAYWRIGHT_PKG = "playwright-core";

// ── Stage tracking ────────────────────────────────────────────────────────────────────────────────────
type StageName =
  | "environment_loaded" | "api_reachability" | "session_creation" | "cdp_connection"
  | "fixture_navigation" | "heading_assertion" | "screenshot_capture" | "controlled_failure_capture"
  | "browser_close" | "session_release";
type StageStatus = "pending" | "passed" | "failed" | "skipped";
const ORDER: StageName[] = [
  "environment_loaded", "api_reachability", "session_creation", "cdp_connection",
  "fixture_navigation", "heading_assertion", "screenshot_capture", "controlled_failure_capture",
  "browser_close", "session_release",
];
const status: Record<StageName, StageStatus> = Object.fromEntries(ORDER.map((s) => [s, "pending"])) as Record<StageName, StageStatus>;
const details: Partial<Record<StageName, Record<string, string>>> = {};
function mark(s: StageName, st: StageStatus, d?: Record<string, string>): void { status[s] = st; if (d) details[s] = { ...(details[s] ?? {}), ...d }; }

// ── stdout capture (to PROVE no secret reaches stdout) ────────────────────────────────────────────────
const originalWrite: typeof process.stdout.write = process.stdout.write.bind(process.stdout);
let captured = "";
function startCapture(): void {
  process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]): boolean => {
    captured += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return (originalWrite as (c: string | Uint8Array, ...a: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof process.stdout.write;
}
function stopCapture(): void { process.stdout.write = originalWrite; }

// ── error sanitizer: sensitive-free diagnostic fields only, cause preserved ────────────────────────────
function sanitize(s: string, apiKey: string): string {
  let out = redactString(String(s ?? ""));
  if (apiKey) out = out.split(apiKey).join("[redacted-key]");
  out = out.replace(/wss?:\/\/[^\s"']+/gi, "[ws-url-redacted]"); // never leak a connectUrl
  return out.slice(0, 400);
}
// Pull ONLY safe fields off an error (Stainless APIError shape + a nested transport cause), sanitizing any
// message. Never returns the api key, connectUrl, signing key, auth headers, or full response headers.
function describeError(e: unknown, apiKey: string): Record<string, string> {
  const err = e as Record<string, unknown> | null;
  const out: Record<string, string> = {};
  const put = (k: string, v: unknown) => { if (v !== undefined && v !== null && v !== "") out[k] = String(v); };
  put("error_name", err?.name);
  put("http_status", err?.status);                                   // Stainless APIError.status (e.g. 401)
  put("error_code", err?.code ?? (err?.error as Record<string, unknown> | undefined)?.code);
  put("request_id", err?.request_id ?? (err as Record<string, unknown>)?.requestID);
  const cause = err?.cause as Record<string, unknown> | undefined;   // undici/fetch transport error lives here
  if (cause) {
    put("cause_name", cause.name);
    put("cause_code", cause.code ?? cause.errno);
    if (cause.message) out.cause_message = sanitize(String(cause.message), apiKey);
    const cc = cause.cause as Record<string, unknown> | undefined;   // undici often nests one deeper
    if (cc) { put("cause_cause_code", cc.code); if (cc.message) out.cause_cause_message = sanitize(String(cc.message), apiKey); }
  }
  if (err?.message) out.message = sanitize(String(err.message), apiKey);
  if (Object.keys(out).length === 0) out.error_name = "unknown_error";
  return out;
}

// ── Minimal structural SDK/Playwright types (deps are lazily imported) ─────────────────────────────────
// The SDK is used ONLY for the non-mutating reachability GET (projects.list). Session create/release go
// through the REST transport in browserbase-api (native fetch), which avoids the SDK's POST content-length bug.
type BB = { projects: { list: (o?: unknown) => Promise<Array<{ id: string }>> } };
type PWPageLike = ConstructorParameters<typeof PlaywrightPreflightPage>[0];
type PWCtx = { pages?: () => unknown[]; newPage?: () => Promise<unknown> };
type PWBrowser = { contexts: () => PWCtx[]; newContext: (o?: unknown) => Promise<PWCtx>; close: () => Promise<void> };

function printStages(): void {
  console.log("\nStage results");
  for (const s of ORDER) {
    console.log(`  ${s.padEnd(28, " ")} ${status[s]}`);
    const d = details[s];
    if (d) for (const [k, v] of Object.entries(d)) console.log(`      ${k}: ${v}`);
  }
}

async function runSmoke(): Promise<number> {
  // 1. Hard gate: never start a paid remote browser by accident.
  if (process.env.VRAELIS_SMOKE !== "1") {
    console.error("Refusing to run: this starts a REAL Browserbase session (costs money).");
    console.error("Enable it explicitly, then re-run:");
    console.error('  PowerShell:  $env:VRAELIS_SMOKE="1"; $env:PREFLIGHT_SMOKE_URL="https://your-owned-fixture"; npm run preflight:smoke:browserbase');
    console.error('  bash:        VRAELIS_SMOKE=1 PREFLIGHT_SMOKE_URL=https://your-owned-fixture npm run preflight:smoke:browserbase');
    console.error("Also required (server-only, never NEXT_PUBLIC): BROWSERBASE_API_KEY — read from the repo's .env.local / .env.preflight. The Browserbase project is inferred from the key; no project id is needed.");
    return 2;
  }

  // 2. Require + validate Browserbase config. loadWorkerConfig throws clearly when the key is missing.
  let apiKey: string;
  let workerId: string;
  try {
    const cfg = loadWorkerConfig({ ...process.env, BROWSER_PROVIDER: "browserbase" });
    if (!cfg.browserbase) throw new Error("browserbase config absent after load");
    apiKey = cfg.browserbase.apiKey;
    workerId = cfg.workerId;
  } catch (e) {
    console.error(`Browserbase not configured: ${(e as Error).message}`);
    return 2;
  }

  // From here on, capture stdout so we can assert no secret was printed.
  startCapture();
  console.log("Vraelis Preflight — Browserbase real-session smoke (staged)");
  console.log(`  Worker: ${workerId}`);

  // 3. environment_loaded: verify the key is clean (present, nonempty, no surrounding whitespace, not quote
  //    wrapped) WITHOUT printing it. Also report proxy/TLS env presence (a stale proxy or custom TLS setting
  //    is a common cause of a generic transport error) — presence only, never values.
  const keyPresent = typeof apiKey === "string" && apiKey.length > 0;
  const keyNoWhitespace = keyPresent && apiKey === apiKey.trim();
  const keyNoQuotes = keyPresent && !((apiKey.startsWith('"') && apiKey.endsWith('"')) || (apiKey.startsWith("'") && apiKey.endsWith("'")));
  const envSet = (n: string) => (process.env[n] !== undefined && process.env[n] !== "" ? "set" : "unset");
  mark("environment_loaded", keyPresent && keyNoWhitespace && keyNoQuotes ? "passed" : "failed", {
    api_key_present: String(keyPresent), api_key_no_surrounding_whitespace: String(keyNoWhitespace),
    api_key_not_quote_wrapped: String(keyNoQuotes),
    HTTP_PROXY: envSet("HTTP_PROXY"), HTTPS_PROXY: envSet("HTTPS_PROXY"), ALL_PROXY: envSet("ALL_PROXY"),
    NODE_EXTRA_CA_CERTS: envSet("NODE_EXTRA_CA_CERTS"), NODE_TLS_REJECT_UNAUTHORIZED: envSet("NODE_TLS_REJECT_UNAUTHORIZED"),
  });
  if (status.environment_loaded === "failed") {
    stopCapture();
    printStages();
    console.log("\nSmoke FAILED at environment_loaded — the API key is missing or malformed in .env.local (whitespace/quotes). Fix the value, never commit it.");
    return 1;
  }

  // 4. Require an owned fixture URL and reject anything private/blocked BEFORE touching the network.
  const fixtureUrl = (process.env.PREFLIGHT_SMOKE_URL || "").trim();
  if (!fixtureUrl) { stopCapture(); console.error("PREFLIGHT_SMOKE_URL is required — a public https fixture you own."); return 2; }
  const urlReason = unsafeHttpsUrlReason(fixtureUrl);
  if (urlReason) { stopCapture(); console.error(`PREFLIGHT_SMOKE_URL rejected by the SSRF gate: ${urlReason}.`); return 2; }
  console.log(`  Fixture: ${fixtureUrl}`);

  // 5. Lazy-import the worker-only deps. Missing deps are a precondition (exit 2), not a failed stage.
  let bb: BB; let chromium: { connectOverCDP: (u: string) => Promise<PWBrowser> };
  try {
    const [SDK, PW] = [BROWSERBASE_PKG, PLAYWRIGHT_PKG];
    const sdkMod = (await import(SDK).catch(() => { throw new Error("browserbase_sdk_missing"); })) as { Browserbase: new (o: { apiKey: string }) => BB };
    const pwMod = (await import(PW).catch(() => { throw new Error("playwright_missing"); })) as { chromium: { connectOverCDP: (u: string) => Promise<PWBrowser> } };
    bb = new sdkMod.Browserbase({ apiKey });
    chromium = pwMod.chromium;
  } catch (e) {
    stopCapture();
    const m = (e as Error).message;
    const which = m === "playwright_missing" ? "playwright-core" : m === "browserbase_sdk_missing" ? "@browserbasehq/sdk" : "the worker browser deps";
    console.error(`Browser runtime dep missing (${which}). Install both, then re-run:`);
    console.error("  npm i --no-save @browserbasehq/sdk playwright-core");
    return 2;
  }

  // 6. api_reachability: FREE, non-mutating projects.list() — proves the API is reachable AND the key is
  //    accepted before spending a paid session. If this fails, the paid create would fail identically, so
  //    we skip it and report the exact transport/auth cause.
  try {
    const projects = await bb.projects.list();
    mark("api_reachability", "passed", { projects_visible: String(Array.isArray(projects) ? projects.length : 0) });
  } catch (e) {
    mark("api_reachability", "failed", describeError(e, apiKey));
    for (const s of ["session_creation", "cdp_connection", "fixture_navigation", "heading_assertion", "screenshot_capture", "controlled_failure_capture", "browser_close", "session_release"] as StageName[]) mark(s, "skipped");
    stopCapture();
    printStages();
    console.log("\nSmoke FAILED at api_reachability — the Browserbase API could not be reached or the key was rejected (see http_status / cause_code above). No paid session was created.");
    return 1;
  }

  // 7. session_creation: wrap bb.sessions.create() ALONE so an API-create failure is distinct from CDP.
  let sessionId = ""; let sessionStatus = ""; let connectUrl = "";
  try {
    const session = await createBrowserbaseSession(apiKey, { userMetadata: safeMetadata({ run_id: `smoke-${workerId}`, flow_run_id: "", worker_id: workerId, env: "internal" }), timeout: 300 });
    sessionId = session.id; sessionStatus = session.status ?? ""; connectUrl = session.connectUrl ?? "";
    mark("session_creation", "passed", { session_id: sessionId, session_status: sessionStatus, connect_url_present: String(!!connectUrl) });
    console.log(`  Session: ${sessionId} (status ${sessionStatus || "unknown"})`); // id + status only; connectUrl NEVER printed
  } catch (e) {
    mark("session_creation", "failed", describeError(e, apiKey));
    for (const s of ["cdp_connection", "fixture_navigation", "heading_assertion", "screenshot_capture", "controlled_failure_capture", "browser_close", "session_release"] as StageName[]) mark(s, "skipped");
    stopCapture();
    printStages();
    console.log("\nSmoke FAILED at session_creation — the API session could not be created (see http_status / error_code / cause_code above).");
    return 1;
  }
  if (!connectUrl) {
    mark("cdp_connection", "failed", { error_name: "no_connect_url" });
    await releaseBrowserbaseSession(apiKey, sessionId).then(() => mark("session_release", "passed")).catch(() => mark("session_release", "failed"));
    stopCapture(); printStages();
    console.log("\nSmoke FAILED — session created but returned no connectUrl.");
    return 1;
  }

  // 8. cdp_connection: connect Playwright over CDP to the returned connectUrl — the official flow. Separate
  //    boundary so a WebSocket/CDP failure (e.g. ECONNRESET) is distinct from API session creation.
  let browser: PWBrowser;
  try {
    browser = await chromium.connectOverCDP(connectUrl);
    mark("cdp_connection", "passed");
  } catch (e) {
    mark("cdp_connection", "failed", describeError(e, apiKey));
    for (const s of ["fixture_navigation", "heading_assertion", "screenshot_capture", "controlled_failure_capture", "browser_close"] as StageName[]) mark(s, "skipped");
    await releaseBrowserbaseSession(apiKey, sessionId).then(() => mark("session_release", "passed")).catch(() => mark("session_release", "failed")); // release the created session
    stopCapture(); printStages();
    console.log("\nSmoke FAILED at cdp_connection — the API session was created but Playwright could not connect over CDP (see cause_code above). The session was released.");
    return 1;
  }

  // 9. Drive ONLY non-destructive browser steps via the SAME PlaywrightPreflightPage the worker uses.
  let released = false;
  try {
    const ctx = browser.contexts()[0] ?? (await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: false, permissions: [] }));
    const rawPage = ctx.pages?.()[0] ?? (await ctx.newPage?.());
    const page = new PlaywrightPreflightPage(rawPage as PWPageLike);

    const nav = await page.perform({ action: "navigate", target: fixtureUrl, timeoutMs: 30000 });
    mark("fixture_navigation", nav.ok ? "passed" : "failed", nav.ok ? undefined : { detail: sanitize(nav.detail, apiKey) });

    const heading = await page.perform({ action: "assert_visible", target: "Your projects", expect: "Your projects" });
    mark("heading_assertion", heading.ok ? "passed" : "failed", heading.ok ? undefined : { detail: sanitize(heading.detail, apiKey) });

    const shot = await page.perform({ action: "screenshot" });
    mark("screenshot_capture", shot.ok ? "passed" : "failed");

    // Controlled failure: assert text that is deliberately absent. ok:false here is the CORRECT outcome.
    const controlled = await page.perform({ action: "assert_visible", target: "This text does not exist", expect: "This text does not exist" });
    mark("controlled_failure_capture", controlled.ok === false ? "passed" : "failed", { observed_ok: String(controlled.ok) });
  } catch (e) {
    // An unexpected throw (not an assertion miss — perform() returns ok:false rather than throwing): mark
    // every still-pending browser stage failed and attribute the sanitized error.
    const diag = describeError(e, apiKey);
    for (const s of ["fixture_navigation", "heading_assertion", "screenshot_capture", "controlled_failure_capture"] as StageName[]) if (status[s] === "pending") mark(s, "failed", diag);
  } finally {
    // 10 + release: close the browser, then REQUEST_RELEASE the session so nothing is left running.
    try { await browser.close(); mark("browser_close", "passed"); } catch (e) { mark("browser_close", "failed", describeError(e, apiKey)); }
    try { await releaseBrowserbaseSession(apiKey, sessionId); mark("session_release", "passed"); released = true; } catch (e) { mark("session_release", "failed", describeError(e, apiKey)); }
  }

  // 11. Secret-leak assertion: the api key and connectUrl must never have hit stdout.
  const noKeyLeak = !captured.includes(apiKey);
  const noConnectUrlLeak = connectUrl.length === 0 || !captured.includes(connectUrl);

  stopCapture();
  printStages();

  const failedStages = ORDER.filter((s) => status[s] === "failed");
  const secretsSafe = noKeyLeak && noConnectUrlLeak;
  console.log(`\nSecret redaction: api_key_leaked=${!noKeyLeak}  connect_url_leaked=${!noConnectUrlLeak}  session_released=${released}`);

  if (failedStages.length > 0 || !secretsSafe) {
    console.log(`\nSmoke FAILED — ${failedStages.length ? `failed stage(s): ${failedStages.join(", ")}` : "no failed stage"}${secretsSafe ? "" : "; SECRET LEAK DETECTED"}.`);
    return 1;
  }
  console.log("\nSmoke PASSED — real Browserbase pipeline verified end to end (reachability, session create, CDP connect, navigation, heading, screenshot, controlled failure, clean close + release, no secrets leaked).");
  return 0;
}

runSmoke()
  .then((code) => { process.exit(code); })
  .catch((e) => { stopCapture(); console.error(`Smoke crashed: ${(e as Error).message}`); process.exit(1); });
