// Vraelis Preflight — REAL Browserbase browser-pipeline smoke. This is the FIRST time an actual Browserbase
// session is created end to end: it proves session create -> navigate -> assert -> screenshot -> the
// FAILURE path -> clean session close, using the SAME BrowserbaseBrowserProvider + PreflightPage the worker
// uses. Nothing here is destructive: it only navigates and asserts on an owned fixture you control.
//
// Because it spends real money and starts a real remote browser, it REFUSES to run unless VRAELIS_SMOKE=1
// and requires: BROWSER_PROVIDER=browserbase, BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID (validated via
// loadWorkerConfig, which throws clearly if creds are missing), and PREFLIGHT_SMOKE_URL (an owned, public
// https fixture, validated by the SSRF string gate before any browser is touched).
//
// Secrets NEVER reach stdout: the Browserbase session URL and API key are never printed, and the run
// asserts (by capturing stdout) that the provider session id never leaked. The one intentionally-failing
// assertion is EXPECTED (ok:false) — it is a successful smoke of the failure pipeline, not an accident.
//
// Run: npm run preflight:smoke:browserbase
// Exit codes: 0 = smoke passed; 1 = a step failed UNEXPECTEDLY; 2 = precondition not met (gate/creds/url/deps).
import { loadWorkerConfig } from "../worker/preflight/config";
import { BrowserbaseBrowserProvider, safeMetadata } from "../worker/preflight/providers/browserbase";
import { unsafeHttpsUrlReason } from "../lib/safe-fetch";
import type { BrowserSession } from "../worker/preflight/types";

// ── stdout capture (to PROVE the session id / api key never reach stdout) ─────────────────────────────
const originalWrite: typeof process.stdout.write = process.stdout.write.bind(process.stdout);
let captured = "";
function startCapture(): void {
  process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]): boolean => {
    captured += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return (originalWrite as (c: string | Uint8Array, ...a: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof process.stdout.write;
}
function stopCapture(): void {
  process.stdout.write = originalWrite;
}

type Check = { label: string; passed: boolean };

async function main(): Promise<void> {
  // 1. Hard gate: never start a paid remote browser by accident.
  if (process.env.VRAELIS_SMOKE !== "1") {
    console.error("Refusing to run: this starts a REAL Browserbase session (costs money).");
    console.error("Enable it explicitly, then re-run:");
    console.error('  PowerShell:  $env:VRAELIS_SMOKE="1"; $env:BROWSER_PROVIDER="browserbase"; $env:PREFLIGHT_SMOKE_URL="https://your-owned-fixture"; npm run preflight:smoke:browserbase');
    console.error('  bash:        VRAELIS_SMOKE=1 BROWSER_PROVIDER=browserbase PREFLIGHT_SMOKE_URL=https://your-owned-fixture npm run preflight:smoke:browserbase');
    console.error("Also required (server-only, never NEXT_PUBLIC): BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID.");
    process.exit(2);
  }

  // 2. Require + validate Browserbase config. loadWorkerConfig throws clearly when creds are missing; we
  //    surface the guidance but NEVER echo the key.
  let browserbase: { apiKey: string; projectId: string };
  let workerId: string;
  try {
    const cfg = loadWorkerConfig({ ...process.env, BROWSER_PROVIDER: "browserbase" });
    if (!cfg.browserbase) throw new Error("browserbase config absent after load");
    browserbase = cfg.browserbase;
    workerId = cfg.workerId;
  } catch (e) {
    console.error(`Browserbase not configured: ${(e as Error).message}`);
    process.exit(2);
  }

  // 3. Require an owned fixture URL and reject anything private/blocked BEFORE touching a browser.
  const fixtureUrl = (process.env.PREFLIGHT_SMOKE_URL || "").trim();
  if (!fixtureUrl) {
    console.error("PREFLIGHT_SMOKE_URL is required — set it to a public https fixture you own (e.g. your preview app).");
    process.exit(2);
  }
  const urlReason = unsafeHttpsUrlReason(fixtureUrl);
  if (urlReason) {
    console.error(`PREFLIGHT_SMOKE_URL rejected by the SSRF gate: ${urlReason}. Use a public https origin you own (no private/loopback/link-local hosts, port 443).`);
    process.exit(2);
  }

  // From here on, capture stdout so we can assert no secret / session id was printed.
  startCapture();
  console.log("Vraelis Preflight — Browserbase real-session smoke");
  console.log(`  Provider: browserbase   Worker: ${workerId}`);
  console.log(`  Fixture:  ${fixtureUrl}`);

  // 4. Redaction of the provider metadata is a PURE check — do it before the session so a failure is cheap.
  const runId = `smoke-${Date.now()}`;
  const meta = safeMetadata({ run_id: runId, flow_run_id: "", worker_id: workerId, env: "internal" });
  const metaJson = JSON.stringify(meta);
  const secretRe = /(authorization|cookie|token|secret|api[-_]?key|password|bearer|signature)/i;
  const metaUnder512 = metaJson.length < 512;
  const metaNoArrays = Object.values(meta).every((v) => typeof v === "string" && !Array.isArray(v)) && !metaJson.includes("[");
  const metaNoSecret = !secretRe.test(metaJson) && !metaJson.includes(browserbase.apiKey);
  const metadataRedacted = metaUnder512 && metaNoArrays && metaNoSecret;

  const checks: Check[] = [];
  const provider = new BrowserbaseBrowserProvider(browserbase);

  // 5. Create the ONE session. Missing runtime deps are a precondition (exit 2), not a failed step.
  let session: BrowserSession;
  try {
    session = await provider.createSession({ runId, environment: "internal", workerId });
  } catch (e) {
    stopCapture();
    const msg = (e as Error).message || "unknown_error";
    if (/browserbase_sdk_missing|playwright_missing/.test(msg)) {
      console.error("Browser runtime deps are not installed for the worker. Install them, then re-run:");
      console.error("  npm i @browserbasehq/sdk playwright-core");
      process.exit(2);
    }
    console.error(`Session creation failed unexpectedly: ${msg}`);
    process.exit(1);
  }
  checks.push({ label: "Session created", passed: !!session.providerSessionId });

  // 6. Drive ONLY non-destructive steps, then close in finally. A failed close must never strand the run.
  let providerClosed = false;
  try {
    const nav = await session.page.perform({ action: "navigate", target: fixtureUrl, timeoutMs: 30000 });
    checks.push({ label: "Navigation", passed: nav.ok });

    const heading = await session.page.perform({ action: "assert_visible", target: "Your projects", expect: "Your projects" });
    checks.push({ label: 'Heading assertion ("Your projects")', passed: heading.ok });

    const shot = await session.page.perform({ action: "screenshot" });
    checks.push({ label: "Screenshot", passed: shot.ok });

    // Controlled failure: assert text that is deliberately absent. SUCCESS here means ok:false — we are
    // smoking the failure pipeline, so ok:false is the expected, correct outcome.
    const controlled = await session.page.perform({ action: "assert_visible", target: "This text does not exist", expect: "This text does not exist" });
    checks.push({ label: "Controlled failure captured", passed: controlled.ok === false });
  } catch (e) {
    checks.push({ label: "Browser steps", passed: false });
    console.error(`Unexpected error while driving the session: ${(e as Error).message}`);
  } finally {
    try {
      await session.close();
      providerClosed = true;
    } catch (e) {
      console.error(`Session close failed: ${(e as Error).message}`);
    }
  }
  checks.push({ label: "Provider closed", passed: providerClosed }); // no session left open

  // 7. Secret redaction check: metadata is safe AND neither the session id nor the api key hit stdout.
  const sid = session.providerSessionId;
  const idNotPrinted = sid.length === 0 || !captured.includes(sid);
  const keyNotPrinted = !captured.includes(browserbase.apiKey);
  checks.push({ label: "Secret redaction check", passed: metadataRedacted && idNotPrinted && keyNotPrinted });

  // 8. Compact summary — stop capturing first (the summary itself carries no secrets).
  stopCapture();
  console.log("\nSmoke summary");
  for (const c of checks) console.log(`  ${c.label.padEnd(36, " ")} ${c.passed ? "passed" : "FAILED"}`);

  const failed = checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    console.log(`\nSmoke FAILED — ${failed.length} step(s) failed unexpectedly: ${failed.map((c) => c.label).join(", ")}`);
    process.exit(1);
  }
  console.log("\nSmoke PASSED — real Browserbase pipeline verified end to end (navigation, assertion, screenshot, failure path, clean close, no secrets leaked).");
  process.exit(0);
}

main().catch((e) => {
  stopCapture();
  console.error(`Smoke crashed: ${(e as Error).message}`);
  process.exit(1);
});
