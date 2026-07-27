// Synthesize the guarantee's plan exactly as the prepare route does, then REHEARSE every flow against the
// live deployment with a local browser, through the worker's own page class and auth executor, before any
// plan is minted or any paid run is launched.
//
// A plan is only worth approving if it can pass. Reading one tells you whether it looks right; running it
// tells you whether the targets exist. Six separate defects today were invisible until something ran.
//
//   npx tsx --env-file=.env.local ops/plan-rehearse.ts --app <id> --guarantee <gid> --owner <email>
//   ... add --mint to write the reviewed plan, which happens ONLY if every step passed.
//
// It writes to the application under test (a proof plan that creates data will create it) and deletes what
// it wrote on the way out. It mints nothing without --mint and it APPROVES NOTHING ever: approval stays a
// deliberate act by a person, against a plan they can now be told has actually run.
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { synthesizeClaim } from "../lib/preflight/verification-lane";
import { resolveCoverage } from "../lib/preflight/coverage-resolve";
import { mintReviewedPlan } from "../lib/preflight/reviewed-plan-db";
import { setGuaranteePlanReview, getGuarantee } from "../lib/preflight/guarantees-db";
import { listConnections, openTestAccount } from "../lib/preflight/connections-db";
import { getApplication } from "../lib/v-applications";
import { PlaywrightPreflightPage } from "../worker/preflight/providers/browserbase";
import { signInAs, resetContext } from "../worker/preflight/auth-executor";

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : d;
};
const OWNER = arg("owner", "demo@vraelis.com");
const APP = arg("app", "843270b4-3e27-4723-9fb7-116482e6e148");
const GID = arg("guarantee", "grt_c8110fd1-563b-41e7-8ef4-c40db1fac6f7");
const TTL_MS = 60 * 60 * 1000;

async function roles(): Promise<string[]> {
  const conns = await listConnections(OWNER, APP);
  return Array.from(new Set(conns.filter((c) => c.provider === "test_account")
    .map((c) => String((c.meta as Record<string, unknown>).role || (c.meta as Record<string, unknown>).label || "").trim()).filter(Boolean)));
}

async function main() {
  const g = await getGuarantee(OWNER, GID);
  const app = await getApplication(OWNER, APP);
  if (!g || !app?.app_url) return console.log("guarantee or application missing");
  const base = app.app_url.replace(/\/$/, "");

  const s = await synthesizeClaim(app.app_url, g.title, { owner: OWNER, applicationId: APP });
  if ("error" in s) return console.log(`synthesis failed: ${s.error} ${s.message}`);
  const rolesAvailable = await roles();
  const resolution = await resolveCoverage(app.app_url, g.title, s.synth, s.pages, { rolesAvailable });
  if (!resolution.readyToLaunch) return console.log(`gate refused: ${resolution.blockedReason}`);

  console.log(`plan has ${resolution.plan.flows.length} flow(s). Rehearsing every step against ${base}\n`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const rawPage = await ctx.newPage();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const page = new PlaywrightPreflightPage(rawPage as any);
  const now = () => Date.now();
  const ident = { owner: OWNER, applicationId: APP };
  const accounts = (await listConnections(OWNER, APP)).filter((c) => c.provider === "test_account").map((c) => ({
    connectionId: c.id,
    label: String((c.meta as Record<string, unknown>).label ?? ""),
    role: String((c.meta as Record<string, unknown>).role ?? (c.meta as Record<string, unknown>).label ?? ""),
    environment: null,
  }));

  let failures = 0;
  for (const flow of resolution.plan.flows) {
    console.log(`FLOW "${flow.name}"  [${flow.priority}]`);
    for (let i = 0; i < flow.steps.length; i++) {
      const st = flow.steps[i] as unknown as Record<string, string | undefined>;
      let ok = false, detail = "";
      if (st.action === "sign_in_as" || st.action === "switch_role") {
        const acc = accounts.find((a) => a.role.toLowerCase() === String(st.target).toLowerCase()) ?? null;
        const r = await signInAs(page, String(st.target), acc as never, openTestAccount, ident, true, {}, now);
        ok = r.ok; detail = r.obs.detail;
      } else if (st.action === "reset_context") {
        const r = await resetContext(page, now); ok = r.ok; detail = r.obs.detail;
      } else {
        const step = { ...st, target: st.action === "navigate" ? base + (st.target ?? "") : st.target };  // the worker rebases an empty navigate onto the app root
        const r = await page.perform(step as never);
        ok = r.ok; detail = String(r.detail);
      }
      if (!ok) failures++;
      console.log(`  ${String(i).padStart(2)} ${ok ? "ok  " : "FAIL"} ${String(st.action).padEnd(20)} ${JSON.stringify(st.target ?? st.expect ?? "").slice(0, 32).padEnd(32)} ${detail.slice(0, 62)}`);
    }
    console.log("");
  }

  // Whatever the rehearsal wrote, remove. A leftover note can satisfy a later run's assertion on its own.
  try {
    await resetContext(page, now);
    await rawPage.goto(`${base}/auth`, { waitUntil: "networkidle", timeout: 60000 });
    const cred = await openTestAccount(OWNER, APP, accounts[0].connectionId);
    if (cred) {
      await rawPage.waitForSelector('input[type="password"]', { timeout: 20000 });
      await rawPage.locator('input[type="email"]').first().fill(cred.username);
      await rawPage.locator('input[type="password"]').first().fill(cred.password);
      await rawPage.locator('button[type="submit"]').first().click();
      await rawPage.waitForURL(/dashboard/, { timeout: 25000 }).catch(() => {});
      await rawPage.waitForTimeout(1500);
      for (let i = 0; i < 8; i++) {
        const del = rawPage.getByRole("button", { name: /^delete$/i }).first();
        if (!(await del.count().catch(() => 0))) break;
        await del.click().catch(() => {}); await rawPage.waitForTimeout(1400);
      }
      const body = (await rawPage.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
      console.log(`cleanup: ${(body.match(/(\d+) \/ 3 notes/) ?? ["", "?"])[1]} / 3 notes remain`);
    }
  } catch { console.log("cleanup could not complete; check the account by hand"); }
  await browser.close();

  if (failures > 0) {
    console.log(`\n${failures} step(s) failed. NOT minting: a plan that cannot pass is not worth a person's approval.\n`);
    process.exitCode = 1;
    return;
  }
  console.log("\nEvery step of every flow passed against the live deployment.");
  if (!process.argv.includes("--mint")) { console.log("Re-run with --mint to write the reviewed plan.\n"); return; }

  const discoveryHash = createHash("sha256").update(JSON.stringify(s.pages ?? [])).digest("hex").slice(0, 32);
  const reviewed = await mintReviewedPlan({
    guaranteeId: GID, owner: OWNER, deploymentUrl: app.app_url, claim: g.title, plan: resolution.plan, discoveryHash,
    coverage: { claim_after: resolution.claimAfter, execution_after: resolution.executionAfter, ready: true },
    ttlMs: TTL_MS, nowMs: Date.now(),
  });
  if (!reviewed) return console.log("mint failed");
  if (g.plan_state === "ok") await setGuaranteePlanReview(OWNER, GID);
  console.log(`MINTED ${reviewed.id}  expires ${reviewed.expiresAt}\n`);
}
main().catch((e) => { console.error("FAILED:", (e as Error).message); process.exit(1); });
