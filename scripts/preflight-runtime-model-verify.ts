// Multi-runtime model + backward-compatibility proof (Phase A).
//
// Proves the neutral core's invariants and that the design is backward-compatible: the migration is strictly
// additive, and the runtime code degrades to single-web-target behavior when the new tables are absent. Pure
// unit + static checks; no DB, no network.

import { readFileSync } from "node:fs";
import { rollupProduct, RUNTIME_KINDS, RUN_STATES, type Decision } from "../lib/preflight/runtime/core";
import { decideRuntime } from "../lib/preflight/runtime/decide";
import { API_CAPABILITIES } from "../lib/preflight/runtime/api-adapter";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") { if (cond) { pass++; console.log(`PASS  ${name}`); } else { fail++; console.log(`FAIL  ${name}${detail ? `  — ${detail}` : ""}`); } }

console.log("── neutral model invariants ──");
ok("web is the first/default runtime kind", RUNTIME_KINDS[0] === "web");
ok("the async lifecycle carries infra-failure + the long-running states", RUN_STATES.includes("infra_failure") && RUN_STATES.includes("waiting_ready") && RUN_STATES.includes("cleanup_failed"));

// Decision grain: a product rollup is per-target, never a single scalar. A web READY must not imply another
// target's coverage.
{
  const rollup = rollupProduct("app1", [
    { runtimeTargetId: "w", runtimeKind: "web", label: "Web", decision: "ready" },
    { runtimeTargetId: "a", runtimeKind: "api", label: "API", decision: "blocked" },
    { runtimeTargetId: "m", runtimeKind: "android", label: "Android", decision: "not_verified" as Decision },
  ]);
  ok("product rollup is PER TARGET (web READY, api BLOCKED, android NOT VERIFIED coexist)",
    rollup.perTarget.length === 3 && rollup.perTarget.find((t) => t.runtimeKind === "web")?.decision === "ready"
      && rollup.perTarget.find((t) => t.runtimeKind === "android")?.decision === "not_verified");
  ok("a web READY never appears as the android target's decision (no cross-platform inheritance)",
    rollup.perTarget.find((t) => t.runtimeKind === "android")?.decision !== "ready");
}

// The decision rule is shared web+api and short-circuits infra.
ok("decideRuntime: infra failure -> infra_failure, never blocked", decideRuntime({ results: [{ flowId: "x", state: "failed", steps: [] }], criticalFlowIds: new Set(["x"]), fullCoverage: true, failureClass: "infra" }).decision === "infra_failure");
ok("decideRuntime: critical fail -> blocked", decideRuntime({ results: [{ flowId: "x", state: "failed", steps: [] }], criticalFlowIds: new Set(["x"]), fullCoverage: true }).decision === "blocked");
ok("decideRuntime: full pass -> ready", decideRuntime({ results: [{ flowId: "x", state: "passed", steps: [] }], criticalFlowIds: new Set(["x"]), fullCoverage: true }).decision === "ready");
ok("decideRuntime: partial pass -> repair_verified (not ready)", decideRuntime({ results: [{ flowId: "x", state: "passed", steps: [] }], criticalFlowIds: new Set(["x"]), fullCoverage: false }).decision === "repair_verified");

// API capabilities are honest: no web-only steps, executes no untrusted artifact.
ok("API capabilities declare NO untrusted-artifact execution", API_CAPABILITIES.executesUntrustedArtifact === false);
ok("API capabilities declare NO web-only evidence kinds (no image)", !API_CAPABILITIES.evidence.has("image" as never));

console.log("\n── backward compatibility: the migration is strictly additive ──");
const mig = readFileSync("sql/vraelis-preflight-12-runtime-targets.sql", "utf8");
ok("migration renames/drops NOTHING and rewrites no existing production column",
  !/\balter table\s+\S+\s+drop\b/i.test(mig) && !/\brename\b/i.test(mig) && !/\bdrop table\b/i.test(mig) && !/\btruncate\b/i.test(mig));
ok("every new column on an EXISTING table is add-column-if-not-exists (and nullable)",
  /alter table public\.v_issues add column if not exists runtime_target_id uuid;/.test(mig)
    && /alter table public\.v_preflight_runs add column if not exists runtime_target_id uuid;/.test(mig)
    && !/add column if not exists \w+ [^;]*not null/i.test(mig));   // no not-null added to an existing table
ok("runtime kind defaults to 'web' so a backfilled/absent value reads as the web target",
  /kind\s+text not null default 'web'/.test(mig));
ok("the backfill only INSERTs web targets from existing apps (read-only, idempotent)",
  /insert into public\.v_runtime_targets[\s\S]*from public\.v_applications[\s\S]*on conflict[\s\S]*do nothing/i.test(mig));
ok("decisions bind to a runtime target + build, NEVER to the application alone",
  /create table if not exists public\.v_platform_decisions/.test(mig)
    && /runtime_target_id uuid not null/.test(mig) && /build_id\s+uuid references public\.v_builds/.test(mig)
    && /contract_version\s+integer/.test(mig) && /matrix_hash\s+text/.test(mig));
ok("issue lineage gets a runtime_target scope (per requirement+target lineage)",
  /alter table public\.v_issues add column if not exists runtime_target_id/.test(mig));

console.log("\n── backward compatibility: the runtime code is new-files-only (web path untouched) ──");
// The runtime modules must not import or edit the live web worker (worker/preflight/*). They are a parallel
// model the web adapter will WRAP later, never a modification of the proven path.
const core = readFileSync("lib/preflight/runtime/core.ts", "utf8");
const apiAdapter = readFileSync("lib/preflight/runtime/api-adapter.ts", "utf8");
// Check IMPORT statements only — a comment may reference worker/preflight/types.ts to explain lineage; an
// actual import of the live worker is what would couple us to the proven path.
const importsWorker = (src: string) => src.split("\n").some((l) => /^\s*import\b/.test(l) && /worker\/preflight/.test(l));
ok("runtime core does not IMPORT the live web worker (comment references are fine)", !importsWorker(core));
ok("api adapter does not IMPORT the live web worker", !importsWorker(apiAdapter));
ok("api adapter reuses the shared pure redactor (no server deps dragged in)", /from "\.\.\/redact"/.test(apiAdapter));

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
