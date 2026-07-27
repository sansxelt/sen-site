// ONE COMMAND, ONE REPRODUCIBLE TOTAL.
//
// The previous "575" was a number assembled by hand: 542 from a selection nobody wrote down, plus 20 from
// the discovery suite and 13 from contract-merge, both of which had no package.json script and could only be
// run by remembering their file paths. A total that cannot be reproduced is not a baseline, it is a memory,
// and a suite that nothing invokes is a suite that silently stops mattering.
//
// Auditing that produced a worse finding than expected: it was not two orphaned suites, it was SEVENTEEN.
// Every one of them passes; none of them ran unless somebody typed the path.
//
// So this file is the registry. Three rules keep it honest:
//
//   1. Every suite listed here must EXIST. A renamed or deleted file fails the run rather than quietly
//      shrinking the total, which is the failure mode that let 17 suites drift out of reach.
//   2. Every suite-shaped file in scripts/ must be either LISTED or EXPLICITLY EXCLUDED with a reason.
//      Adding a new suite and not registering it fails the run. Coverage cannot decay by omission.
//   3. The run stops at the first failing suite, and prints the per-suite and total assertion counts.
//
// Excluded suites are the ones that need a live database or live credentials. They are named, with the
// reason, rather than left off the list: "not in the aggregate" must never be indistinguishable from
// "forgotten".
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.cwd();
const TSX_CLI = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");

type Suite = { file: string; npm?: string };

// Every pure/static suite. `npm` is the package.json script where one exists; the runner invokes the file
// directly either way, so a suite is runnable here whether or not anyone remembered to wire it up.
const SUITES: Suite[] = [
  { file: "scripts/preflight-provenance-integrity-verify.ts", npm: "provenance:integrity:test" },
  { file: "scripts/preflight-provenance-verify.ts", npm: "provenance:test" },
  { file: "scripts/preflight-discovery-verify.ts", npm: "discovery:test" },
  { file: "scripts/preflight-contract-merge-verify.ts", npm: "merge:test" },
  { file: "scripts/preflight-reviewed-plan-verify.ts", npm: "reviewed-plan:test" },
  { file: "scripts/preflight-acceptance-boundary-verify.ts", npm: "preflight:acceptance:test" },
  // Ships in the Guarantees increments, which are live in production and absent from the
  // verification-contract branch. The registry caught that asymmetry rather than silently skipping it.
  { file: "scripts/preflight-guarantee-logic-verify.ts" },

  { file: "scripts/preflight-account-deletion-verify.ts", npm: "account:test" },
  { file: "scripts/preflight-agent-verify.ts", npm: "agent:test" },
  { file: "scripts/preflight-api-beta-verify.ts", npm: "api:beta:test" },
  { file: "scripts/preflight-api-canary-surface-verify.ts", npm: "api:canary:test" },
  { file: "scripts/preflight-api-key-access-verify.ts", npm: "apikey:access:test" },
  { file: "scripts/preflight-api-runtime-verify.ts", npm: "api:runtime:test" },
  { file: "scripts/preflight-artifacts-verify.ts", npm: "preflight:artifacts:test" },
  { file: "scripts/preflight-assert-scope-verify.ts", npm: "preflight:assert-scope:test" },
  { file: "scripts/preflight-auth-flows-verify.ts", npm: "auth:flows:test" },
  { file: "scripts/preflight-boundaries-verify.ts", npm: "boundaries:test" },
  { file: "scripts/preflight-browserbase-transport-verify.ts", npm: "preflight:transport:test" },
  { file: "scripts/preflight-target-resolver-verify.ts" },
  { file: "scripts/preflight-command-center-verify.ts", npm: "command:center:test" },
  { file: "scripts/preflight-connect-verify.ts", npm: "preflight:connect:test" },
  { file: "scripts/preflight-connections-manage-verify.ts", npm: "connections:manage:test" },
  { file: "scripts/preflight-context-verify.ts", npm: "context:test" },
  { file: "scripts/preflight-cost-governor-verify.ts", npm: "cost:governor:test" },
  { file: "scripts/preflight-coverage-verify.ts", npm: "preflight:coverage:test" },
  { file: "scripts/preflight-decision-verify.ts", npm: "preflight:decision:test" },
  { file: "scripts/preflight-deployments-verify.ts", npm: "deployments:test" },
  { file: "scripts/preflight-dispute-dedupe-verify.ts", npm: "dispute:dedupe:test" },
  { file: "scripts/preflight-entitlements-verify.ts", npm: "pricing:entitlements:test" },
  { file: "scripts/preflight-fixture-rerun-verify.ts", npm: "preflight:fixture-rerun:test" },
  { file: "scripts/preflight-flow-authoring-verify.ts", npm: "flows:authoring:test" },
  { file: "scripts/preflight-free-grant-dedup-verify.ts", npm: "free:grant:test" },
  { file: "scripts/preflight-human-eval-retired-verify.ts", npm: "human-eval-retired:test" },
  { file: "scripts/preflight-launch-affordance-verify.ts", npm: "launch:affordance:test" },
  { file: "scripts/preflight-limits-verify.ts", npm: "preflight:limits:test" },
  { file: "scripts/guarantee-binding-verify.ts", npm: "guarantee:binding:test" },
  { file: "scripts/credit-hold-verify.ts", npm: "credit:hold:test" },
  { file: "scripts/preflight-reconcile-verify.ts", npm: "preflight:reconcile:test" },
  { file: "scripts/preflight-role-ui-verify.ts", npm: "role:ui:test" },
  { file: "scripts/preflight-routes-verify.ts", npm: "routes:test" },
  { file: "scripts/preflight-scope-verify.ts", npm: "preflight:scope:test" },
  { file: "scripts/preflight-security-verify.ts", npm: "preflight:security:test" },
  { file: "scripts/preflight-target-verify.ts", npm: "preflight:target:test" },
  { file: "scripts/preflight-teams-verify.ts", npm: "teams:test" },
  { file: "scripts/preflight-verifications-verify.ts", npm: "verifications:test" },
  { file: "scripts/preflight-web-characterization-verify.ts", npm: "web:characterization:test" },
  { file: "scripts/preflight-webhook-decoupling-verify.ts", npm: "webhooks:decoupled:test" },
  { file: "scripts/preflight-webhook-dispatch-verify.ts", npm: "webhooks:test" },
  { file: "scripts/preflight-worker-lifecycle-verify.ts", npm: "preflight:worker:test" },
  { file: "scripts/preflight-runtime-model-verify.ts", npm: "runtime:model:test" },
  { file: "scripts/billing-returns-verify.ts", npm: "billing:returns:test" },
  { file: "scripts/pass-pricing-verify.ts", npm: "pricing:pass:test" },
  { file: "scripts/pricing-copy-verify.ts", npm: "pricing:copy:test" },
  { file: "scripts/pricing-v1-ui-verify.ts", npm: "pricing:v1:ui:test" },
  { file: "scripts/research-verify.ts", npm: "research:test" },
  { file: "scripts/app-shell-verify.ts", npm: "shell:test" },
  { file: "scripts/host-contract-verify.ts", npm: "host:test" },
  { file: "scripts/custom-checkout-verify.ts", npm: "checkout:test" },
  { file: "scripts/verification-client-verify.ts", npm: "client:test" },
  { file: "scripts/contrast-verify.ts", npm: "contrast:test" },
  { file: "scripts/verification-idempotency-verify.ts", npm: "idempotency:test" },
  { file: "scripts/email-embeds-verify.ts", npm: "email:test" },
  { file: "scripts/terminology-verify.ts", npm: "terminology:test" },
  { file: "scripts/cli-verify-test.mjs", npm: "cli:test" },

  // Unwired before this change. Every one passes; none of them ran unless someone typed the path.
  { file: "scripts/composer-verify.ts" },
  { file: "scripts/decision-contract-verify.ts" },
  { file: "scripts/design01-inc5-verify.ts" },
  { file: "scripts/design02-result-verify.ts" },
  { file: "scripts/home-verify.ts" },
  { file: "scripts/preflight-ci-gate-verify.ts" },
  { file: "scripts/preflight-issue-claims-verify.ts" },
  { file: "scripts/preflight-issues-verify.ts" },
  { file: "scripts/preflight-oauth-pkce-verify.ts" },
  { file: "scripts/preflight-oauth-registry-verify.ts" },
  { file: "scripts/preflight-oauth-state-verify.ts" },
  { file: "scripts/preflight-repair-prompt-verify.ts" },
  { file: "scripts/preflight-url-policy-verify.ts" },
];

// Named, with the reason, so "excluded" is never mistaken for "forgotten".
const EXCLUDED: Record<string, string> = {
  "scripts/preflight-seed-run-verify.ts": "writes fixture rows to a live database",
  "scripts/preflight-settings-verify.ts": "reads a live database",
  "scripts/preflight-verify-db.ts": "live database inspection",
  "scripts/preflight-verify-migration-12.ts": "live database inspection",
  "scripts/preflight-smoke-browserbase.ts": "live third-party browser session",
  "scripts/preflight-seed-run.ts": "live seeding driver, not a suite",
  "scripts/preflight-seed-test-account.ts": "live seeding driver, not a suite",
  "scripts/preflight-verify-run.ts": "drives a real paid run",
  "scripts/preflight-reviewed-plan-smoke.ts": "drives a real paid run",
  "scripts/preflight-api-key-lifecycle.ts": "mints real API keys",
  "scripts/preflight-fixture-rerun.ts": "live rerun driver, not a suite",
  "scripts/preflight-balance-convert.ts": "mutates live balances",
  "scripts/preflight-invalidate-runs.ts": "mutates live runs",
  "scripts/preflight-repair-decision.ts": "mutates live decisions",
  "scripts/preflight-coverage-correction-verify.ts": "calls a live model",
  // Passes 11/11, but every assertion is against a real synthesis: it needs an API key, costs money per
  // run, and is not reproducible. Its pure parts belong in a suite that does not call out.
  "scripts/preflight-synthesis-verify.ts": "calls a live model",
  "scripts/preflight-coverage-dryrun.ts": "calls a live model",
  "scripts/outreach.ts": "sends real email",
};

let hardFail = false;
const problem = (msg: string) => { hardFail = true; console.log(`ERROR  ${msg}`); };

// ── RULE 1: every listed suite exists ──────────────────────────────────────────────────────────────────
for (const s of SUITES) {
  if (!existsSync(join(ROOT, s.file))) problem(`listed suite is missing: ${s.file}`);
}
if (!existsSync(TSX_CLI)) problem(`cannot find the tsx CLI at ${TSX_CLI}; run npm install`);

// ── RULE 2: every suite-shaped file is listed or explicitly excluded ───────────────────────────────────
const listed = new Set(SUITES.map((s) => s.file));
for (const f of readdirSync(join(ROOT, "scripts")).sort()) {
  const rel = `scripts/${f}`;
  if (!/\.(ts|mjs)$/.test(f) || listed.has(rel) || rel in EXCLUDED) continue;
  const src = readFileSync(join(ROOT, rel), "utf8");
  const looksLikeSuite = /\bok\(/.test(src) && /passed/.test(src);
  if (looksLikeSuite) problem(`unregistered suite: ${rel} (add it to SUITES, or to EXCLUDED with a reason)`);
}

// ── RULE 3: package.json actually exposes every suite that claims a script name ────────────────────────
{
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> };
  for (const s of SUITES) {
    if (s.npm && !pkg.scripts[s.npm]) problem(`suite ${s.file} claims npm script "${s.npm}", which package.json does not define`);
  }
}

if (hardFail) {
  console.log("\nRegistry is inconsistent. No suite was run.");
  process.exit(1);
}

// ── Run ────────────────────────────────────────────────────────────────────────────────────────────────
// Tolerant of the three count formats in use: "N passed, M failed", "N/M passed", "N passed".
function countOf(output: string): number | null {
  const tail = output.split("\n").reverse().slice(0, 12).join("\n");
  const a = tail.match(/(\d+)\s*\/\s*(\d+)\s+passed/);
  if (a) return Number(a[1]);
  const b = tail.match(/(\d+)\s+passed/);
  if (b) return Number(b[1]);
  return null;
}

console.log(`Running ${SUITES.length} suites.\n`);
let total = 0;
let ran = 0;
const unparsed: string[] = [];

for (const s of SUITES) {
  // No shell, ever. Spawning `npx` would mean spawning a .cmd on Windows, which modern Node refuses without
  // a shell, and a shell concatenates arguments instead of escaping them. Running the resolved tsx CLI under
  // this same node binary avoids both, and pins the tsx the repo actually installed.
  const args = s.file.endsWith(".mjs") ? [s.file] : [TSX_CLI, s.file];
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: "utf8" });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status !== 0) {
    console.log(out);
    console.log(`\nFAILED  ${s.file}${s.npm ? ` (npm run ${s.npm})` : ""}`);
    console.log(`Stopped after ${ran} of ${SUITES.length} suites, ${total} assertions.`);
    process.exit(1);
  }
  const n = countOf(out);
  if (n === null) unparsed.push(s.file);
  else total += n;
  ran++;
  console.log(`  ${String(n ?? "?").padStart(4)}  ${s.file}${s.npm ? "" : "   (no npm script)"}`);
}

console.log(`\n${ran} suites, ${total} assertions, 0 failures.`);
if (unparsed.length) {
  // A suite whose total cannot be read would silently contribute nothing to the baseline.
  console.log(`\nCould not read an assertion count from: ${unparsed.join(", ")}`);
  process.exit(1);
}
