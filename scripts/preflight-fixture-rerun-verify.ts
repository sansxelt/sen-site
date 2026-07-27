// Driver validation for scripts/preflight-fixture-rerun.ts. Static source analysis (no DB): proves the
// LINKED rerun driver reuses the parent's application/contract/flow identities via the canonical helpers,
// sets parent_run_id, never inserts results/issues/evidence/decisions/resolution, and keeps every internal
// and production safeguard. This is the "linked, not fresh" guarantee, enforced.
import fs from "node:fs";
import { before } from "./_source-order";
import path from "node:path";

const src = fs.readFileSync(path.join(process.cwd(), "scripts", "preflight-fixture-rerun.ts"), "utf8");
// Comment-stripped view for negative checks (doc comments may NAME the forbidden things while explaining
// they never happen). Preserve `https://`.
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const inserts = (table: string) => new RegExp(`\\.from\\(["']${table}["']\\)\\s*\\.insert`).test(code);

// ── Linked, same identities, canonical path ──
ok("loads the PARENT run via canonical getRunInternal", /getRunInternal\(/.test(code));
ok("reuses the parent's applicationId (no new application)", /parent\.applicationId/.test(code) && !inserts("v_applications"));
ok("reuses the parent's contract id + version (no new contract)", /parent\.contractId/.test(code) && /parent\.contractVersion/.test(code) && !inserts("v_production_contracts"));
ok("reuses existing flow identities (no new requirements/flows)", !inserts("v_contract_requirements") && !inserts("v_test_flows"));
ok("selects failed flows from the parent via parentRunFlows", /parentRunFlows\(/.test(code));
ok("queues via canonical createRun (no direct run insert)", /createRun\(/.test(code) && !inserts("v_preflight_runs"));
ok("links the new run to the parent (setParentRun)", /setParentRun\(/.test(code));

// ── Scope semantics ──
ok("default scope is failed-only", /arg\("scope",\s*"failed"\)/.test(code));
ok("supports the final critical scope", /"critical"/.test(code) && /priority[\s\S]{0,40}critical|critical[\s\S]{0,40}priority/.test(code));
ok("supports a full all scope", /"all"/.test(code));

// ── Never seeds outcomes ──
for (const t of ["v_flow_runs", "v_run_steps", "v_issues", "v_run_artifacts", "v_repairs"]) {
  ok(`never inserts into ${t}`, !inserts(t));
}
ok("never seeds a decision or resolution", !/\b(decision|resolved_run|first_seen_run|status:\s*"resolved")\s*:/.test(code));

// ── Safeguards ──
ok("requires PREFLIGHT_SEED_RUN=1", /PREFLIGHT_SEED_RUN\s*!==\s*"1"/.test(code));
ok("prod safeguard uses a pre-load runtime snapshot", /const RUNTIME\s*=/.test(src) && before(src, "const RUNTIME", "loadLocalEnv()") && /RUNTIME\.VERCEL_ENV/.test(code));
ok("refuses production unless explicitly overridden", /PREFLIGHT_SEED_ALLOW_PROD/.test(code));
ok("requires an owner email (no silent ownership bypass)", /includes\("@"\)/.test(code));
ok("verifies the artifact bucket before queueing", /preflightArtifactBucketExists/.test(code));
ok("dev-free credits (credits_held 0)", /creditsHeld:\s*0/.test(code));

// ── Mode snapshot + safe output ──
ok("snapshots the new fixture mode URL onto the run", /mode=\$\{mode\}|\?mode=/.test(src) && /deploymentUrl:\s*url/.test(code));
ok("outputs parent run id + new run id + report route", /parent run id:/.test(src) && /new run id:/.test(src) && /report route:/.test(src));
ok("code never references connectUrl / Browserbase key / signed url / signing key", !/(connectUrl|BROWSERBASE_API_KEY|signedArtifactUrl|signingKey)/.test(code));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
