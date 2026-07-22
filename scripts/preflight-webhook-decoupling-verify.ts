// Phase 3.07 regression lock: after retiring the human-evaluation "Rank" product, the
// verification webhooks must carry NO trace of the retired Decision Package, and the
// account-level developer webhooks (lib/v-webhooks) must fire verification.completed —
// NOT the retired Rank test.completed. Static + one runtime assertion (no DB, no network).
//
// Context: there are two webhook channels, both delivering the SAME owner-safe payload:
//   (1) per-app connection webhooks  — lib/preflight/webhook-dispatch.ts (worker)
//   (2) account-level API-console webhooks — lib/v-webhooks.ts (worker, signed + retry-queued)
// The Decision Package (lib/v-decision-package.ts) and lib/v-export.ts were deleted; nothing
// may import them, and neither webhook path may reference them.

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

process.env.VRAELIS_SECRET_KEY = process.env.VRAELIS_SECRET_KEY || "a".repeat(64);

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? "  — " + detail : ""}`); }
}

const read = (p: string) => readFileSync(p, "utf8");
const DP = /v-decision-package|buildDecisionPackage|SAMPLE_DECISION_PACKAGE/;

// ── (1) the current per-app verification webhook is Decision-Package-free ──
const dispatch = read("lib/preflight/webhook-dispatch.ts");
ok("webhook-dispatch.ts references no Decision Package", !DP.test(dispatch));
ok("webhook-dispatch.ts emits verification.completed", dispatch.includes('"verification.completed"'));

// ── (2) the account-level webhook (v-webhooks) is decoupled from the Rank report/DP path ──
const vw = read("lib/v-webhooks.ts");
ok("v-webhooks.ts references no Decision Package", !DP.test(vw));
ok("v-webhooks.ts no longer imports the Rank report path (getReport/getTestWithOptions/OPTION_LETTERS from v-db)",
  !/from "\.\/v-db"/.test(vw) && !/getReport|getTestWithOptions|OPTION_LETTERS/.test(vw));
ok("v-webhooks.ts delivers verification.completed, not the retired test.completed",
  vw.includes("deliverVerificationCompleted") && vw.includes('"verification.completed"')
  && !vw.includes("deliverTestCompleted") && !/event:\s*"test\.completed"/.test(vw));
ok("v-webhooks.ts reuses the shared owner-safe payload type (VerificationWebhookPayload)",
  vw.includes("VerificationWebhookPayload"));

// ── (3) the run finalizer drives BOTH channels with the one owner-safe payload ──
const finalizer = read("worker/preflight/run-store-postgres.ts");
ok("finalizer references no Decision Package", !DP.test(finalizer));
ok("finalizer delivers to per-app connections (dispatchVerificationWebhooks)", finalizer.includes("dispatchVerificationWebhooks"));
ok("finalizer delivers to account-level endpoints (deliverVerificationCompleted)", finalizer.includes("deliverVerificationCompleted"));
ok("finalizer flushes the retry queue after delivery (runWebhookRetries)", finalizer.includes("runWebhookRetries"));

// ── (4) v-db no longer triggers any webhook (the Rank completeTest → test.completed trigger is gone) ──
const vdb = read("lib/v-db.ts");
ok("v-db.ts no longer imports or triggers v-webhooks", !/v-webhooks/.test(vdb) && !/deliverTestCompleted/.test(vdb));

// ── (5) repo-wide: the deleted Decision Package / export libs have zero importers ──
const SRC = ["app", "lib", "worker", "scripts", "sdk", "cli", "components"];
function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]; try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) { if (e !== "node_modules" && e !== ".next") walk(p, out); }
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(e)) out.push(p);
  }
  return out;
}
const files = SRC.flatMap((d) => walk(d));
const dpImporters = files.filter((f) => /from ["'].*v-decision-package["']|from ["'].*\/v-export["']/.test(read(f)));
ok("no file imports the deleted v-decision-package or v-export", dpImporters.length === 0, dpImporters.join(", "));

// ── (6) runtime: the verification payload is exactly the owner-safe allowlist (no Rank/DP fields) ──
(async () => {
  const { buildVerificationPayload } = await import("../lib/preflight/webhook-dispatch");
  const payload = buildVerificationPayload({
    runId: "run-1", applicationId: "app-1", decision: "ready",
    flowsTotal: 4, flowsPassed: 4, deploymentUrl: "https://demo.example.com", appBaseUrl: "https://app.vraelis.com",
  });
  ok("verification payload key set is exactly the owner-safe allowlist",
    JSON.stringify(Object.keys(payload).sort()) === JSON.stringify(
      ["application_id", "completed_at", "decision", "deployment_url", "event", "flows_passed", "flows_total", "report_url", "run_id"]));
  const RANK = ["decision_package", "winner", "votes", "votes_valid", "votes_filtered", "audience_fit", "preference_margin", "win_probability"];
  const serialized = JSON.stringify(payload).toLowerCase();
  ok("verification payload carries NO Rank / Decision-Package field",
    RANK.every((k) => !Object.keys(payload).some((f) => f.toLowerCase() === k)) && !/decision_package|preference_margin|win_probability/.test(serialized));

  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})();
