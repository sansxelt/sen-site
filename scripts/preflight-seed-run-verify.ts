// Driver validation for scripts/preflight-seed-run.ts. Static source analysis (no DB): proves the driver
// seeds CONFIG + APPROVED DEFINITIONS ONLY and never inserts result/evidence rows, uses the canonical
// createRun, carries the dev-only safeguards, requires an owner, verifies the bucket, prints no secrets, and
// only uses worker-supported step actions. This is the "no seeded findings" guarantee, enforced.
import fs from "node:fs";
import { before } from "./_source-order";
import path from "node:path";

const src = fs.readFileSync(path.join(process.cwd(), "scripts", "preflight-seed-run.ts"), "utf8");
// Comment-stripped view for the secret-leak check (a doc comment may legitimately NAME connectUrl/signed URL
// while explaining they are never printed). Preserve `https://` (the `//` is preceded by `:`).
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const inserts = (table: string) => new RegExp(`\\.from\\(["']${table}["']\\)\\s*\\.insert`).test(src);

// ── The driver must NEVER seed result/evidence/decision rows (the whole point) ──
for (const t of ["v_flow_runs", "v_run_steps", "v_issues", "v_run_artifacts", "v_repairs"]) {
  ok(`never inserts into ${t} (results/evidence come from the real worker)`, !inserts(t));
}
ok("never seeds a decision", !/\bdecision\s*:/.test(src));
ok("never seeds issues/evidence/screenshots/resolution", !/\b(evidence|screenshot|likely_cause|resolved_run|first_seen_run)\s*:/.test(src));
ok("never inserts a v_preflight_runs row directly (uses createRun)", !inserts("v_preflight_runs") && /createRun\(/.test(src));

// ── It DOES seed config + approved definitions ──
for (const t of ["v_applications", "v_production_contracts", "v_contract_requirements", "v_test_flows"]) {
  ok(`seeds ${t}`, inserts(t));
}
ok("contract is seeded APPROVED", /status:\s*"approved"/.test(src));
ok("requirements + flows seeded review_state approved", /review_state:\s*"approved"/.test(src) && /approved:\s*true/.test(src));

// ── Dev-only safeguards + ownership ──
ok("requires PREFLIGHT_SEED_RUN=1", /PREFLIGHT_SEED_RUN\s*!==\s*"1"/.test(src));
ok("refuses production unless explicitly overridden", /PREFLIGHT_SEED_ALLOW_PROD/.test(src) && /production/.test(src));
ok("prod safeguard uses a pre-load runtime snapshot (ignores file-loaded VERCEL_ENV)", /const RUNTIME\s*=/.test(src) && before(src, "const RUNTIME", "loadLocalEnv()") && /RUNTIME\.VERCEL_ENV/.test(src));
ok("requires an owner email (no silent ownership bypass)", /owner/.test(src) && /includes\("@"\)/.test(src));
ok("verifies the artifact bucket before queueing", /preflightArtifactBucketExists/.test(src));
ok("dev-free credits (credits_held 0)", /creditsHeld:\s*0/.test(src));

// ── Never prints secrets (naming SUPABASE_SERVICE_ROLE_KEY in a "missing config" error is fine; it is a var
// name, never a value) ──
ok("code never references connectUrl / Browserbase key / signed url / signing key", !/(connectUrl|BROWSERBASE_API_KEY|signedArtifactUrl|signingKey)/.test(code));
ok("never logs a service-key VALUE", !/console\.\w+\([^)]*process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(src));

// ── Flow steps use ONLY worker-supported actions ──
const SUPPORTED = ["navigate", "click", "fill", "select", "check", "uncheck", "press", "wait_for", "assert_visible", "assert_text", "assert_url", "refresh", "new_context", "screenshot"];
const actions = Array.from(src.matchAll(/action:\s*"([a-z_]+)"/g)).map((m) => m[1]);
ok("flow steps present + all worker-supported", actions.length >= 8 && actions.every((a) => SUPPORTED.includes(a)), Array.from(new Set(actions)).join(","));

// ── Targets the deployed fixture with a mode ──
ok("targets the deployed fixture with ?mode=", /preflight-demo-ten\.vercel\.app/.test(src) && /\?mode=/.test(src));
ok("outputs the report route + ids", /report route:/.test(src) && /application id:/.test(src) && /run id:/.test(src));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
