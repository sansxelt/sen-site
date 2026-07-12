// Internal development driver: LINKED rerun of a prior Preflight run against a new fixture mode, using the
// canonical rerun/run-creation path (the same lib functions the rerun route uses). It reuses the SAME
// application, contract version, requirement + flow identities as the parent, creates a NEW immutable run
// with parent_run_id set, snapshots the new mode URL, and reruns the parent's failed flows by default.
//
// It seeds NO results, issues, evidence, decisions, or resolution state. The worker claims the run off the
// same Postgres queue, drives the same Browserbase provider + artifact uploader, and finalizes; issue
// continuity + resolution happen worker-side. Dev/internal only, prod-safe (same safeguards as seed-run).
//
// Run: PREFLIGHT_SEED_RUN=1 npm run preflight:fixture-rerun -- --run=<parentRunId> --mode=partially_fixed --owner=you@example.com [--scope=failed|critical|all]
import { loadLocalEnv } from "../worker/preflight/local-env";
import { isDatabaseConfigured } from "../lib/supabase-admin";
import { preflightArtifactBucketExists } from "../lib/preflight/artifacts";
import { getRunInternal, parentRunFlows, setParentRun } from "../lib/preflight/run-report-db";
import { createRun } from "../lib/preflight/runs-db";
import { selectFailedFlows } from "../lib/preflight/flow-selection";
import { listFlows } from "../lib/v-applications";

// Capture the REAL runtime env BEFORE loading .env.local (a vercel env pull writes VERCEL_ENV=production into
// .env.local; loading it does not make this local CLI a production process).
const RUNTIME = { NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV, VERCEL: process.env.VERCEL };
loadLocalEnv();

const FIXTURE_BASE = "https://preflight-demo-ten.vercel.app";
const MODES = ["broken", "partially_fixed", "fixed"] as const;
const SCOPES = ["failed", "critical", "all"] as const;
type Mode = (typeof MODES)[number];
type Scope = (typeof SCOPES)[number];

function arg(name: string, def?: string): string | undefined {
  const pre = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pre));
  return hit ? hit.slice(pre.length) : def;
}

async function main(): Promise<void> {
  // 1. Dev/internal-only gate + prod safeguard (evaluated on the pre-.env-load runtime).
  if (process.env.PREFLIGHT_SEED_RUN !== "1") {
    console.error("Refusing to run: set PREFLIGHT_SEED_RUN=1 to use the internal rerun driver.");
    process.exit(2);
  }
  const prodSignals: string[] = [];
  if (RUNTIME.NODE_ENV === "production") prodSignals.push("NODE_ENV=production");
  if (RUNTIME.VERCEL_ENV === "production") prodSignals.push("VERCEL_ENV=production");
  if (RUNTIME.VERCEL === "1" && RUNTIME.VERCEL_ENV !== "development" && RUNTIME.VERCEL_ENV !== "preview") prodSignals.push("deployed-runtime marker VERCEL=1");
  if (prodSignals.length && process.env.PREFLIGHT_SEED_ALLOW_PROD !== "1") {
    console.error(`Refusing to rerun: the process runtime looks like production (${prodSignals.join("; ")}). Set PREFLIGHT_SEED_ALLOW_PROD=1 only to target a protected production environment.`);
    process.exit(2);
  }

  // 2. Owner is required (owner-scoped; never bypass ownership).
  const owner = (arg("owner") || process.env.PREFLIGHT_SEED_OWNER || "").trim().toLowerCase();
  if (!owner || !owner.includes("@")) {
    console.error("An owner email is required. Pass --owner=you@example.com or set PREFLIGHT_SEED_OWNER.");
    process.exit(2);
  }

  // 3. Parent run id + new mode + scope.
  const parentRunId = (arg("run") || "").trim();
  if (!parentRunId) { console.error("A parent run id is required. Pass --run=<parentRunId>."); process.exit(2); }
  const mode = (arg("mode") || "") as Mode;
  if (!MODES.includes(mode)) { console.error(`--mode is required, one of: ${MODES.join(" | ")}`); process.exit(2); }
  const scope = (arg("scope", "failed") || "failed") as Scope;
  if (!SCOPES.includes(scope)) { console.error(`Invalid --scope. Use one of: ${SCOPES.join(" | ")}`); process.exit(2); }
  const url = `${FIXTURE_BASE}/?mode=${mode}`;

  // 4. Preconditions.
  if (!isDatabaseConfigured()) { console.error("Database not configured (.env.local not loaded)."); process.exit(2); }
  if (!(await preflightArtifactBucketExists())) { console.error('Artifact bucket "vraelis-preflight-artifacts" is missing. Create it before rerunning.'); process.exit(2); }

  // 5. Load the parent run (owner-scoped). Reuse its application + approved contract version + flow identities.
  const parent = await getRunInternal(owner, parentRunId);
  if (!parent) {
    console.error("Parent run not found for this owner.");
    console.error("  Check you passed a RUN id (printed as 'new run id' / in the report route), not a flow id from the 'selected flows' list.");
    process.exit(1);
  }
  if (!parent.contractId) { console.error("Parent run has no contract to rerun against."); process.exit(1); }

  const contractFlows = (await listFlows(owner, parent.contractId))
    .filter((f) => f.enabled && (((f as { review_state?: string }).review_state ?? "approved") === "approved"));
  const nameById = new Map(contractFlows.map((f) => [f.id, f.name]));

  // 6. Select flows by scope, off the parent's actually-executed flows (failed/all) or the contract (critical).
  let flowIds: string[];
  if (scope === "critical") {
    flowIds = contractFlows.filter((f) => (f as { priority?: string }).priority === "critical").map((f) => f.id);
  } else {
    const pf = await parentRunFlows(owner, parentRunId);
    if (scope === "all") flowIds = pf.map((f) => f.testFlowId);
    else flowIds = selectFailedFlows(pf); // shared 'failed' rule (scripts/preflight-scope-verify.ts)
    if (!flowIds.length && scope === "all") flowIds = contractFlows.map((f) => f.id); // parent ran nothing -> whole contract
  }
  flowIds = Array.from(new Set(flowIds)).filter((id) => nameById.has(id)); // only currently approved+enabled
  if (!flowIds.length) { console.error(`No matching flows to rerun for scope=${scope}.`); process.exit(1); }

  // 7. Queue via the canonical createRun (state 'queued', dev-free credits_held 0), then link to the parent.
  const submissionId = `rerun-${mode}-${scope}-${parentRunId.slice(0, 8)}`;
  const created = await createRun(owner, {
    applicationId: parent.applicationId, contractId: parent.contractId, contractVersion: parent.contractVersion,
    deploymentUrl: url, submissionId, flowIds, creditsHeld: 0, reservationId: null,
  });
  if (!created || "conflict" in created) {
    // Conflict now means an ACTIVE or COMPLETED-VALID rerun holds this parent+mode+scope; an invalidated,
    // cancelled, or infrastructure-failed occupant no longer blocks (createRun queues a replacement).
    console.error("Failed to queue rerun:", created && "conflict" in created
      ? `an in-flight or completed rerun for this parent+mode+scope already exists${created.runId ? ` (run ${created.runId})` : ""}`
      : "no eligible flows / insert failed");
    process.exit(1);
  }
  await setParentRun(owner, created.runId, parentRunId); // provenance (degrades if parent_run_id column absent)

  // 8. Output SAFE fields only.
  console.log("\nQueued a LINKED rerun (config only; NO results/issues/evidence/decisions/resolution seeded).");
  console.log(`  application id:  ${parent.applicationId}`);
  console.log(`  parent run id:   ${parentRunId}`);
  console.log(`  new run id:      ${created.runId}  (state: queued)`);
  console.log(`  mode:            ${mode}   (${url})`);
  console.log(`  scope:           ${scope}`);
  console.log(`  selected flows (${flowIds.length}):`);
  for (const id of flowIds) console.log(`    - ${id}  ${nameById.get(id) ?? ""}`);
  console.log(`  report route:    https://app.vraelis.com/applications/${parent.applicationId}/passes/${created.runId}`);
  process.exit(0);
}

main().catch((e) => { console.error(`fixture-rerun crashed: ${(e as Error).message}`); process.exit(1); });
